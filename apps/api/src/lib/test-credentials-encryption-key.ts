/**
 * @file apps/api/src/lib/test-credentials-encryption-key.ts
 *
 * Fixed 32-byte key for unit tests. Never use in production.
 */

export const TEST_CREDENTIALS_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");

export function withTestCredentialsEncryptionKey<T>(run: () => T): T {
  const previous = process.env.CREDENTIALS_ENCRYPTION_KEY;
  process.env.CREDENTIALS_ENCRYPTION_KEY = TEST_CREDENTIALS_ENCRYPTION_KEY;
  try {
    return run();
  } finally {
    if (previous === undefined) {
      delete process.env.CREDENTIALS_ENCRYPTION_KEY;
    } else {
      process.env.CREDENTIALS_ENCRYPTION_KEY = previous;
    }
  }
}
