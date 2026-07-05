/**
 * @file apps/api/src/lib/credentials-encryption.ts
 *
 * AES-256-GCM encryption for user provider API keys at rest.
 * Plaintext legacy rows (no prefix) are still readable and re-encrypted on read.
 */

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
const KEY_LENGTH = 32;
export const ENCRYPTED_VALUE_PREFIX = "enc:v1:";

function getEncryptionKey(): Buffer {
  const encoded = process.env.CREDENTIALS_ENCRYPTION_KEY?.trim();
  if (!encoded) {
    throw new Error(
      "CREDENTIALS_ENCRYPTION_KEY is required to store or read encrypted credentials",
    );
  }

  const key = Buffer.from(encoded, "base64");
  if (key.length !== KEY_LENGTH) {
    throw new Error(
      `CREDENTIALS_ENCRYPTION_KEY must decode to ${KEY_LENGTH} bytes (generate with: openssl rand -base64 32)`,
    );
  }

  return key;
}

export function isEncryptedStoredValue(value: string): boolean {
  return value.startsWith(ENCRYPTED_VALUE_PREFIX);
}

export function encryptSecret(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  const payload = Buffer.concat([iv, authTag, ciphertext]);
  return `${ENCRYPTED_VALUE_PREFIX}${payload.toString("base64")}`;
}

export function decryptSecret(stored: string): string {
  if (!isEncryptedStoredValue(stored)) {
    return stored;
  }

  const key = getEncryptionKey();
  const payload = Buffer.from(stored.slice(ENCRYPTED_VALUE_PREFIX.length), "base64");
  if (payload.length <= IV_LENGTH + AUTH_TAG_LENGTH) {
    throw new Error("Stored credential payload is too short to decrypt");
  }

  const iv = payload.subarray(0, IV_LENGTH);
  const authTag = payload.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const ciphertext = payload.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}
