/**
 * apps/api/src/routes/config.ts
 *
 * Configuration discovery routes proxied to the Python agents-service.
 * Hosted-plan users may have no personal keys — merge platform keys so
 * provider resolve and model catalogs still work.
 */

import { Hono } from "hono";
import type { ModelMode, ProviderModelsResponse } from "@tradingagents/api-types";
import { getModelCreditMultiplier } from "@tradingagents/api-types";
import { getSupabaseAdmin } from "@tradingagents/supabase";
import {
  fetchConfigOptions,
  fetchCredentialsSchema,
  fetchProviderModels,
  fetchProviderModelsPublic,
  resolveConfig,
} from "../services/agents-client.js";
import { getBillingAccount } from "../services/billing-account-service.js";
import { getRequestUserId, requireUserId } from "../middleware/user-context.js";
import { mergeHostedPlatformCredentials } from "../services/platform-keys-service.js";
import { resolveRequestCredentials } from "../services/request-credentials.js";
import { resolveCreditMultiplier } from "../services/credit-service.js";

export const configRoutes = new Hono();

const MODEL_MODES = new Set<ModelMode>(["all", "quick", "deep"]);

function parseModelMode(value: unknown): ModelMode | null {
  if (typeof value !== "string") {
    return null;
  }
  return MODEL_MODES.has(value as ModelMode) ? (value as ModelMode) : null;
}

async function resolveCredentialsWithPlatformKeys(
  c: Parameters<typeof resolveRequestCredentials>[0],
  providerIds?: readonly string[],
) {
  const userCredentials = (await resolveRequestCredentials(c)) ?? {};
  const userId = getRequestUserId(c);
  const client = getSupabaseAdmin(c);
  const billing = await getBillingAccount(client, userId);
  const isHostedPlan =
    billing.subscription.planId === "hosted" &&
    billing.subscription.status === "active";

  return mergeHostedPlatformCredentials(client, userCredentials, {
    isHostedPlan,
    hostedProviderIds: billing.hostedProviderIds,
    providerIds,
  });
}

async function enrichModelsWithCreditMultipliers(
  c: Parameters<typeof resolveRequestCredentials>[0],
  provider: string,
  response: ProviderModelsResponse,
): Promise<ProviderModelsResponse> {
  const client = getSupabaseAdmin(c);
  const models = await Promise.all(
    response.models.map(async (model) => {
      let creditMultiplier: number;
      try {
        creditMultiplier = await resolveCreditMultiplier(client, provider, model.id);
      } catch {
        creditMultiplier = getModelCreditMultiplier(provider, model.id);
      }
      return {
        ...model,
        creditMultiplier,
      };
    }),
  );
  return { ...response, models };
}

configRoutes.get("/config/credentials/schema", async (c) => {
  const schema = await fetchCredentialsSchema();
  return c.json(schema);
});

configRoutes.post("/config/resolve", requireUserId(), async (c) => {
  try {
    const providerCredentials = await resolveCredentialsWithPlatformKeys(c);
    const resolved = await resolveConfig(providerCredentials);
    return c.json(resolved);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid request";
    return c.json({ error: message }, 400);
  }
});

configRoutes.get("/config/options", async (c) => {
  const options = await fetchConfigOptions();
  return c.json(options);
});

configRoutes.post("/config/providers/:provider/models", requireUserId(), async (c) => {
  const provider = c.req.param("provider");
  if (!provider) {
    return c.json({ error: "Provider is required" }, 400);
  }
  const body = (await c.req.json()) as {
    mode?: ModelMode;
  };
  const mode = parseModelMode(body.mode ?? "all");
  if (!mode) {
    return c.json({ error: "Field mode must be all, quick, or deep" }, 400);
  }

  try {
    const providerCredentials = await resolveCredentialsWithPlatformKeys(c, [
      provider,
    ]);
    const hasProviderKey = Boolean(
      providerCredentials[provider.toLowerCase()]?.apiKey?.trim(),
    );

    const raw = hasProviderKey
      ? await fetchProviderModels(provider, mode, providerCredentials)
      : await fetchProviderModelsPublic(provider, mode);
    return c.json(await enrichModelsWithCreditMultipliers(c, provider, raw));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Request failed";
    if (message.includes("403") || message.includes("No credentials")) {
      try {
        const raw = await fetchProviderModelsPublic(provider, mode);
        return c.json(await enrichModelsWithCreditMultipliers(c, provider, raw));
      } catch {
        return c.json({ error: "No credentials for this provider" }, 403);
      }
    }
    return c.json({ error: `Unknown provider: ${provider}` }, 404);
  }
});

configRoutes.get("/config/providers/:provider/models", async (c) => {
  const provider = c.req.param("provider");
  const mode = parseModelMode(c.req.query("mode") ?? "all");

  if (!mode) {
    return c.json({ error: "Query param mode must be all, quick, or deep" }, 400);
  }

  try {
    const raw = await fetchProviderModelsPublic(provider, mode);
    return c.json(await enrichModelsWithCreditMultipliers(c, provider, raw));
  } catch {
    return c.json({ error: `Unknown provider: ${provider}` }, 404);
  }
});
