/**
 * apps/api/src/services/credentials-service.ts
 *
 * Persists per-user provider credentials server-side. Secret values are never
 * returned from read paths — callers receive a fixed placeholder instead.
 */

import type { ProviderCredentials } from "@tradingagents/api-types";
import { SECRET_CREDENTIAL_PLACEHOLDER } from "@tradingagents/api-types";
import type { AppSupabaseClient, UserCredentialRow } from "@tradingagents/supabase";
import {
  decryptSecret,
  encryptSecret,
  isEncryptedStoredValue,
} from "../lib/credentials-encryption.js";

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

function storedSecretValue(fieldName: string, value: string): string {
  if (!isSecretField(fieldName)) {
    return value;
  }
  return encryptSecret(value);
}

function readableSecretValue(fieldName: string, stored: string): string {
  if (!isSecretField(fieldName)) {
    return stored;
  }
  return decryptSecret(stored);
}

function rowsToProviderCredentials(
  rows: Array<{ provider_id: string; field_name: string; field_value: string }>,
): ProviderCredentials {
  const credentials: ProviderCredentials = {};

  for (const row of rows) {
    credentials[row.provider_id] = {
      ...(credentials[row.provider_id] ?? {}),
      [row.field_name]: readableSecretValue(row.field_name, row.field_value),
    };
  }

  return credentials;
}

async function migratePlaintextSecrets(
  client: AppSupabaseClient,
  userId: string,
  rows: UserCredentialRow[],
): Promise<void> {
  const now = new Date().toISOString();

  for (const row of rows) {
    if (!isSecretField(row.field_name) || isEncryptedStoredValue(row.field_value)) {
      continue;
    }

    const { error } = await client.from("user_credentials").upsert(
      {
        user_id: userId,
        provider_id: row.provider_id,
        field_name: row.field_name,
        field_value: storedSecretValue(row.field_name, row.field_value),
        updated_at: now,
      },
      { onConflict: "user_id,provider_id,field_name" },
    );

    if (error) {
      throw new Error(error.message);
    }
  }
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

  const rows = (data ?? []) as UserCredentialRow[];
  await migratePlaintextSecrets(client, userId, rows);
  return rowsToProviderCredentials(rows);
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
          field_value: storedSecretValue(fieldName, value),
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

/** Returns the raw database value for a credential field (ciphertext for secrets). */
export async function getStoredCredentialFieldValue(
  client: AppSupabaseClient,
  userId: string,
  providerId: string,
  fieldName: string,
): Promise<string | null> {
  const { data, error } = await client
    .from("user_credentials")
    .select("field_value")
    .eq("user_id", userId)
    .eq("provider_id", providerId)
    .eq("field_name", fieldName)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  const row = data as { field_value: string } | null;
  return row?.field_value ?? null;
}
