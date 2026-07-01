/**
 * apps/api/src/routes/credentials.ts
 *
 * Read/write user provider credentials. Secret values are masked on every response.
 */

import { Hono } from "hono";
import type { ProviderCredentials } from "@tradingagents/api-types";
import { getRequestUserId, requireUserId } from "../middleware/user-context.js";
import {
  getUserCredentialsMasked,
  saveUserCredentials,
} from "../services/credentials-service.js";

export const credentialsRoutes = new Hono();

credentialsRoutes.use("*", requireUserId());

credentialsRoutes.get("/credentials", async (c) => {
  const userId = getRequestUserId(c);
  const credentials = await getUserCredentialsMasked(userId);
  return c.json({ providerCredentials: credentials });
});

credentialsRoutes.put("/credentials", async (c) => {
  const userId = getRequestUserId(c);
  const body = (await c.req.json()) as {
    providerCredentials?: ProviderCredentials;
  };

  const credentials = await saveUserCredentials(
    userId,
    body.providerCredentials ?? {},
  );

  return c.json({ providerCredentials: credentials });
});
