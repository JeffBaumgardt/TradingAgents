/**
 * apps/api/src/services/credentials-service.ts
 *
 * Persists per-user provider credentials server-side. Secret values are never
 * returned from read paths — callers receive a fixed placeholder instead.
 */

import type { ProviderCredentials } from "@tradingagents/api-types";
import { SECRET_CREDENTIAL_PLACEHOLDER } from "@tradingagents/api-types";
import type { AppSupabaseClient, UserCredentialRow } from "../db/database.js";

const SECRET_FIELD_NAMES = new Set(["apiKey"]);

function normalizeProviderCredentials(
  credentials: ProviderCredentials | null | undefined,
): ProviderCredentials {
  if (!credentials) {
    return {};
  }

  const normalized: ProviderCredentials = {};
  for (const [providerId, fields] of Object.entries(credentials)) {
    const providerKey = providerId.toLowerCase().trim();
    if (!fields) {
      continue;
    }

    const cleaned: Record<string, string> = {};
    for (const [fieldName, value] of Object.entries(fields)) {
      if (typeof value !== "string") {
        continue;
      }
      const trimmed = value.trim();
      if (trimmed) {
        cleaned[fieldName] = trimmed;
      }
    }

    if (Object.keys(cleaned).length > 0) {
      normalized[providerKey] = cleaned;
    }
  }

  return normalized;
}

function isSecretField(fieldName: string): boolean {
  return SECRET_FIELD_NAMES.has(fieldName);
}

export function isSecretPlaceholder(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) {
    return false;
  }
  return trimmed === SECRET_CREDENTIAL_PLACEHOLDER || /^\*+$/.test(trimmed);
}

function rowsToProviderCredentials(
  rows: Array<{ provider_id: string; field_name: string; field_value: string }>,
): ProviderCredentials {
  const credentials: ProviderCredentials = {};

  for (const row of rows) {
    credentials[row.provider_id] = {
      ...(credentials[row.provider_id] ?? {}),
      [row.field_name]: row.field_value,
    };
  }

  return credentials;
}

function maskSecretFields(credentials: ProviderCredentials): ProviderCredentials {
  const masked: ProviderCredentials = {};

  for (const [providerId, fields] of Object.entries(credentials)) {
    if (!fields) {
      continue;
    }

    const maskedFields: Record<string, string> = {};
    for (const [fieldName, value] of Object.entries(fields)) {
      maskedFields[fieldName] = isSecretField(fieldName)
        ? SECRET_CREDENTIAL_PLACEHOLDER
        : value;
    }

    masked[providerId] = maskedFields;
  }

  return masked;
}

export async function getUserCredentialsRaw(
  client: AppSupabaseClient,
  userId: string,
): Promise<ProviderCredentials> {
  const { data, error } = await client
    .from("user_credentials")
    .select("provider_id, field_name, field_value")
    .eq("user_id", userId);

  if (error) {
    throw new Error(error.message);
  }

  return rowsToProviderCredentials((data ?? []) as UserCredentialRow[]);
}

export async function getUserCredentialsMasked(
  client: AppSupabaseClient,
  userId: string,
): Promise<ProviderCredentials> {
  const raw = await getUserCredentialsRaw(client, userId);
  return maskSecretFields(raw);
}

export async function saveUserCredentials(
  client: AppSupabaseClient,
  userId: string,
  incoming: ProviderCredentials,
): Promise<ProviderCredentials> {
  const normalized = normalizeProviderCredentials(incoming);
  const now = new Date().toISOString();

  for (const [providerId, fields] of Object.entries(normalized)) {
    if (!fields) {
      continue;
    }

    for (const [fieldName, value] of Object.entries(fields)) {
      if (isSecretField(fieldName) && isSecretPlaceholder(value)) {
        continue;
      }

      const { error } = await client.from("user_credentials").upsert(
        {
          user_id: userId,
          provider_id: providerId,
          field_name: fieldName,
          field_value: value,
          updated_at: now,
        },
        { onConflict: "user_id,provider_id,field_name" },
      );

      if (error) {
        throw new Error(error.message);
      }
    }
  }

  return getUserCredentialsMasked(client, userId);
}
