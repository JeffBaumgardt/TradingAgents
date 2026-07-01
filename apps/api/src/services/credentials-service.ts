/**
 * apps/api/src/services/credentials-service.ts
 *
 * Persists per-user provider credentials server-side. Secret values are never
 * returned from read paths — callers receive a fixed placeholder instead.
 */

import { eq } from "drizzle-orm";
import type { ProviderCredentials } from "@tradingagents/api-types";
import { SECRET_CREDENTIAL_PLACEHOLDER } from "@tradingagents/api-types";
import { db } from "../db/index.js";
import { userCredentials } from "../db/schema.js";

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
  rows: Array<{ providerId: string; fieldName: string; fieldValue: string }>,
): ProviderCredentials {
  const credentials: ProviderCredentials = {};

  for (const row of rows) {
    credentials[row.providerId] = {
      ...(credentials[row.providerId] ?? {}),
      [row.fieldName]: row.fieldValue,
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

export async function getUserCredentialsRaw(userId: string): Promise<ProviderCredentials> {
  const rows = await db
    .select()
    .from(userCredentials)
    .where(eq(userCredentials.userId, userId));

  return rowsToProviderCredentials(rows);
}

export async function getUserCredentialsMasked(userId: string): Promise<ProviderCredentials> {
  const raw = await getUserCredentialsRaw(userId);
  return maskSecretFields(raw);
}

export async function saveUserCredentials(
  userId: string,
  incoming: ProviderCredentials,
): Promise<ProviderCredentials> {
  const normalized = normalizeProviderCredentials(incoming);
  const now = new Date();

  for (const [providerId, fields] of Object.entries(normalized)) {
    if (!fields) {
      continue;
    }

    for (const [fieldName, value] of Object.entries(fields)) {
      if (isSecretField(fieldName) && isSecretPlaceholder(value)) {
        continue;
      }

      await db
        .insert(userCredentials)
        .values({
          userId,
          providerId,
          fieldName,
          fieldValue: value,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: [
            userCredentials.userId,
            userCredentials.providerId,
            userCredentials.fieldName,
          ],
          set: {
            fieldValue: value,
            updatedAt: now,
          },
        });
    }
  }

  return getUserCredentialsMasked(userId);
}
