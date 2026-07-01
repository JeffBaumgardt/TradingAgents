/**
 * apps/api/src/services/request-credentials.ts
 *
 * Loads stored credentials for the current request user. Request bodies must
 * never be trusted as the source of secret API keys once a user id is present.
 */

import type { Context } from "hono";
import type { ProviderCredentials } from "@tradingagents/api-types";
import { getSupabaseAdmin } from "../db/client.js";
import { getUserCredentialsRaw } from "./credentials-service.js";

export async function resolveRequestCredentials(
  c: Context,
): Promise<ProviderCredentials | null> {
  const userId = c.req.header("X-User-Id")?.trim();
  if (!userId) {
    return null;
  }

  return getUserCredentialsRaw(getSupabaseAdmin(c), userId);
}

export async function requireRequestCredentials(c: Context): Promise<ProviderCredentials> {
  const credentials = await resolveRequestCredentials(c);
  if (!credentials || Object.keys(credentials).length === 0) {
    throw new Error("No stored credentials found for this user");
  }
  return credentials;
}
