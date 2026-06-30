/**
 * apps/api/src/routes/config.ts
 *
 * Configuration discovery routes proxied to the Python agents-service.
 * Supports credential-aware provider/model filtering.
 */

import { Hono } from "hono";
import type { ProviderCredentials } from "@tradingagents/api-types";
import {
  fetchConfigOptions,
  fetchCredentialsSchema,
  fetchProviderModels,
  resolveConfig,
} from "../services/agents-client.js";

export const configRoutes = new Hono();

configRoutes.get("/config/credentials/schema", async (c) => {
  const schema = await fetchCredentialsSchema();
  return c.json(schema);
});

configRoutes.post("/config/resolve", async (c) => {
  const body = (await c.req.json()) as {
    providerCredentials?: ProviderCredentials;
  };
  const resolved = await resolveConfig(body.providerCredentials ?? {});
  return c.json(resolved);
});

configRoutes.get("/config/options", async (c) => {
  const options = await fetchConfigOptions();
  return c.json(options);
});

configRoutes.post("/config/providers/:provider/models", async (c) => {
  const provider = c.req.param("provider");
  const body = (await c.req.json()) as {
    mode: "quick" | "deep";
    providerCredentials?: ProviderCredentials;
  };

  if (body.mode !== "quick" && body.mode !== "deep") {
    return c.json({ error: "Field mode must be quick or deep" }, 400);
  }

  try {
    const models = await fetchProviderModels(
      provider,
      body.mode,
      body.providerCredentials ?? {},
    );
    return c.json(models);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Request failed";
    if (message.includes("403")) {
      return c.json({ error: "No credentials for this provider" }, 403);
    }
    return c.json({ error: `Unknown provider: ${provider}` }, 404);
  }
});

configRoutes.get("/config/providers/:provider/models", async (c) => {
  const provider = c.req.param("provider");
  const mode = c.req.query("mode");

  if (mode !== "quick" && mode !== "deep") {
    return c.json({ error: "Query param mode must be quick or deep" }, 400);
  }

  try {
    const models = await fetchProviderModels(provider, mode);
    return c.json(models);
  } catch {
    return c.json({ error: `Unknown provider: ${provider}` }, 404);
  }
});
