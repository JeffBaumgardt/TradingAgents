/**
 * apps/api/src/routes/credentials.ts
 *
 * Read/write user provider credentials. Secret values are masked on every response.
 */

import { Hono } from "hono";
import type { ProviderCredentials } from "@tradingagents/api-types";
import { getSupabaseAdmin } from "@tradingagents/supabase";
import { getRequestUserId, requireUserId } from "../middleware/user-context.js";
import {
  getUserCredentialsMasked,
  saveUserCredentials,
} from "../services/credentials-service.js";

export const credentialsRoutes = new Hono();

// Scope auth to /credentials only — use("*") on an app mounted at "/" would
// intercept later public routes (e.g. share-by-link GET /sessions/:id).
credentialsRoutes.use("/credentials", requireUserId());
credentialsRoutes.use("/credentials/*", requireUserId());

credentialsRoutes.get("/credentials", async (c) => {
  const userId = getRequestUserId(c);
  const client = getSupabaseAdmin(c);
  const credentials = await getUserCredentialsMasked(client, userId);
  return c.json({ providerCredentials: credentials });
});

credentialsRoutes.put("/credentials", async (c) => {
  const userId = getRequestUserId(c);
  const body = (await c.req.json()) as {
    providerCredentials?: ProviderCredentials;
  };
  const client = getSupabaseAdmin(c);

  const credentials = await saveUserCredentials(
    client,
    userId,
    body.providerCredentials ?? {},
  );

  return c.json({ providerCredentials: credentials });
});
