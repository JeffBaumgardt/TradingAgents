/**
 * apps/api/src/services/platform-keys-service.ts
 *
 * Hosted (platform) provider API keys. Ciphertext never leaves the server;
 * there is no public HTTP route to list or read these rows.
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
 * Inject platform API keys for hosted-plan providers the user did not supply.
 * User BYOK keys always win. Used by config resolve / model catalog routes.
 */
export async function mergeHostedPlatformCredentials(
  client: AppSupabaseClient,
  userCredentials: ProviderCredentials,
  options: {
    isHostedPlan: boolean;
    hostedProviderIds: readonly string[];
    /** Limit injection to these providers; defaults to all hostedProviderIds. */
    providerIds?: readonly string[];
  },
): Promise<ProviderCredentials> {
  if (!options.isHostedPlan) {
    return userCredentials;
  }

  const hostedSet = new Set(
    options.hostedProviderIds.map((id) => id.toLowerCase().trim()).filter(Boolean),
  );
  const targets = (options.providerIds ?? options.hostedProviderIds)
    .map((id) => id.toLowerCase().trim())
    .filter((id) => id && hostedSet.has(id));

  let merged: ProviderCredentials = userCredentials;
  for (const providerId of targets) {
    if (merged[providerId]?.apiKey?.trim()) {
      continue;
    }
    const platformKey = await getPlatformApiKeyPlaintext(client, providerId);
    if (!platformKey) {
      continue;
    }
    merged = {
      ...merged,
      [providerId]: {
        ...(merged[providerId] ?? {}),
        apiKey: platformKey,
      },
    };
  }
  return merged;
}

/**
 * Merge user BYOK credentials with platform keys for hosted providers the user
 * did not supply. User keys always win (self_pay path).
 */
export async function resolveRunProviderCredentials(
  client: AppSupabaseClient,
  userCredentials: ProviderCredentials,
  options: {
    isHostedPlan: boolean;
    hostedProviderIds: readonly string[];
    selectedProviderId: string;
  },
): Promise<{
  credentials: ProviderCredentials;
  costSource: "hosted" | "self_pay";
  usedPlatformKey: boolean;
}> {
  const selected = options.selectedProviderId.toLowerCase().trim();
  const userKey = userCredentials[selected]?.apiKey?.trim();
  if (userKey) {
    return {
      credentials: userCredentials,
      costSource: "self_pay",
      usedPlatformKey: false,
    };
  }

  if (!options.isHostedPlan) {
    return {
      credentials: userCredentials,
      costSource: "self_pay",
      usedPlatformKey: false,
    };
  }

  const hostedOk = options.hostedProviderIds
    .map((id) => id.toLowerCase())
    .includes(selected);
  if (!hostedOk) {
    return {
      credentials: userCredentials,
      costSource: "self_pay",
      usedPlatformKey: false,
    };
  }

  const credentials = await mergeHostedPlatformCredentials(client, userCredentials, {
    isHostedPlan: true,
    hostedProviderIds: options.hostedProviderIds,
    providerIds: [selected],
  });
  const usedPlatformKey = Boolean(credentials[selected]?.apiKey?.trim());

  // Fail closed: never mark traffic as hosted (or bill credits) unless we
  // actually injected a platform key. Missing rows must not fall through to
  // agents-service process-env keys as an unpaid/shared sidecar.
  return {
    credentials,
    costSource: usedPlatformKey ? "hosted" : "self_pay",
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
