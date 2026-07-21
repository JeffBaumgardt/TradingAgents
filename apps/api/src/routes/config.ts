/**
 * apps/api/src/routes/config.ts
 *
 * Configuration discovery routes proxied to the Python agents-service.
 * Hosted-plan users may have no personal keys — mark hosted providers as
 * available in resolve responses without ever forwarding platform API keys.
 * Model catalogs use the public static list when the user has no BYOK key.
 */

import { Hono } from "hono";
import type {
  ModelMode,
  ProviderModelsResponse,
  ResolvedConfigResponse,
} from "@tradingagents/api-types";
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
import { resolveRequestCredentials } from "../services/request-credentials.js";
import { resolveCreditMultiplier } from "../services/credit-service.js";
import { canonicalBackendUrlForProvider } from "../lib/provider-backend-urls.js";

export const configRoutes = new Hono();

const MODEL_MODES = new Set<ModelMode>(["all", "quick", "deep"]);

function parseModelMode(value: unknown): ModelMode | null {
  if (typeof value !== "string") {
    return null;
  }
  return MODEL_MODES.has(value as ModelMode) ? (value as ModelMode) : null;
}

/**
 * Hosted subscribers can run without BYOK. Enrich resolve so the wizard sees
 * those providers — without decrypting or forwarding platform keys.
 */
function enrichResolvedConfigForHostedPlan(
  resolved: ResolvedConfigResponse,
  hostedProviderIds: readonly string[],
): ResolvedConfigResponse {
  const hostedIds = hostedProviderIds
    .map((id) => id.toLowerCase().trim())
    .filter(Boolean);
  if (hostedIds.length === 0) {
    return resolved;
  }

  const schemaById = new Map(
    resolved.credentialsSchema.providers.map((provider) => [
      provider.id.toLowerCase(),
      provider,
    ]),
  );
  const providersById = new Map(
    resolved.providers.map((provider) => [provider.id.toLowerCase(), provider]),
  );

  for (const hostedId of hostedIds) {
    if (providersById.has(hostedId)) {
      continue;
    }
    const schema = schemaById.get(hostedId);
    providersById.set(hostedId, {
      id: hostedId,
      label: schema?.label ?? hostedId,
      backendUrl: schema?.backendUrl ?? canonicalBackendUrlForProvider(hostedId),
    });
  }

  const available = new Set([
    ...(resolved.availableProviderIds ?? []),
    ...hostedIds,
  ]);

  return {
    ...resolved,
    providers: [...providersById.values()],
    availableProviderIds: [...available],
  };
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
    // User BYOK only — never merge platform keys into this internal hop.
    const userCredentials = (await resolveRequestCredentials(c)) ?? {};
    const userId = getRequestUserId(c);
    const client = getSupabaseAdmin(c);
    const billing = await getBillingAccount(client, userId);
    const isHostedPlan =
      billing.subscription.planId === "hosted" &&
      billing.subscription.status === "active";

    const resolved = await resolveConfig(userCredentials);
    if (!isHostedPlan) {
      return c.json(resolved);
    }
    return c.json(
      enrichResolvedConfigForHostedPlan(resolved, billing.hostedProviderIds),
    );
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
    // Static catalogs do not need keys. Only forward the user's own BYOK —
    // never decrypt platform keys just to list models.
    const userCredentials = (await resolveRequestCredentials(c)) ?? {};
    const providerKey = provider.toLowerCase();
    const hasUserKey = Boolean(userCredentials[providerKey]?.apiKey?.trim());

    const raw = hasUserKey
      ? await fetchProviderModels(provider, mode, userCredentials)
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
