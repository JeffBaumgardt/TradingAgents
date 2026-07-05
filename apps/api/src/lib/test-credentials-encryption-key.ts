/**
 * @file apps/api/src/lib/test-credentials-encryption-key.ts
 *
 * Fixed 32-byte key for unit tests. Never use in production.
 */

export const TEST_CREDENTIALS_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
