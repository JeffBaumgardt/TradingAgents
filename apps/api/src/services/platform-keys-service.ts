/**
 * apps/api/src/services/platform-keys-service.ts
 *
 * Platform provider API keys for product runs. Ciphertext never leaves the
 * server; there is no public HTTP route to list or read these rows.
 */

import type { ProviderCredentials } from "@tradingagents/api-types";
import type { AppSupabaseClient, PlatformApiKeyRow } from "@tradingagents/supabase";
import { decryptSecret, encryptSecret } from "../lib/credentials-encryption.js";

export async function getPlatformApiKeyPlaintext(
  client: AppSupabaseClient,
  providerId: string,
): Promise<string | null> {
  const key = providerId.toLowerCase().trim();
  if (!key) {
    return null;
  }

  const { data, error } = await client
    .from("platform_api_keys")
    .select("encrypted_api_key, is_active")
    .eq("provider_id", key)
    .maybeSingle();

  if (error) {
    throw new Error(`platform_api_keys read failed: ${error.message}`);
  }
  if (!data) {
    return null;
  }

  const row = data as Pick<PlatformApiKeyRow, "encrypted_api_key" | "is_active">;
  if (!row.is_active) {
    return null;
  }

  const plaintext = decryptSecret(row.encrypted_api_key).trim();
  return plaintext || null;
}

/**
 * Load platform API keys for the given providers (product runs never use
 * personal keys).
 */
export async function loadPlatformCredentials(
  client: AppSupabaseClient,
  providerIds: readonly string[],
): Promise<ProviderCredentials> {
  const targets = [
    ...new Set(providerIds.map((id) => id.toLowerCase().trim()).filter(Boolean)),
  ];

  let credentials: ProviderCredentials = {};
  for (const providerId of targets) {
    const platformKey = await getPlatformApiKeyPlaintext(client, providerId);
    if (!platformKey) {
      continue;
    }
    credentials = {
      ...credentials,
      [providerId]: {
        apiKey: platformKey,
      },
    };
  }
  return credentials;
}

/**
 * Resolve provider credentials for a product run from platform keys only.
 */
export async function resolveRunProviderCredentials(
  client: AppSupabaseClient,
  options: {
    isHostedPlan: boolean;
    hostedProviderIds: readonly string[];
    selectedProviderId: string;
  },
): Promise<{
  credentials: ProviderCredentials;
  usedPlatformKey: boolean;
}> {
  const selected = options.selectedProviderId.toLowerCase().trim();
  if (!selected || !options.isHostedPlan) {
    return {
      credentials: {},
      usedPlatformKey: false,
    };
  }

  const hostedOk = options.hostedProviderIds
    .map((id) => id.toLowerCase())
    .includes(selected);
  if (!hostedOk) {
    return {
      credentials: {},
      usedPlatformKey: false,
    };
  }

  const credentials = await loadPlatformCredentials(client, [selected]);
  const usedPlatformKey = Boolean(credentials[selected]?.apiKey?.trim());

  return {
    credentials,
    usedPlatformKey,
  };
}

/** Admin/ops helper — encrypts and upserts a platform key (CLI / manual tooling). */
export async function upsertPlatformApiKey(
  client: AppSupabaseClient,
  input: {
    providerId: string;
    apiKey: string;
    label?: string | null;
    notes?: string | null;
    isActive?: boolean;
  },
): Promise<void> {
  const providerId = input.providerId.toLowerCase().trim();
  const apiKey = input.apiKey.trim();
  if (!providerId || !apiKey) {
    throw new Error("providerId and apiKey are required");
  }

  const now = new Date().toISOString();
  const { error } = await client.from("platform_api_keys").upsert(
    {
      provider_id: providerId,
      encrypted_api_key: encryptSecret(apiKey),
      label: input.label ?? null,
      notes: input.notes ?? null,
      is_active: input.isActive ?? true,
      updated_at: now,
    },
    { onConflict: "provider_id" },
  );

  if (error) {
    throw new Error(`platform_api_keys upsert failed: ${error.message}`);
  }
}
