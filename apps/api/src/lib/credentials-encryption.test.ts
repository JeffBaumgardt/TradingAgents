/**
 * @file apps/api/src/lib/credentials-encryption.test.ts
 */

import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import {
  decryptSecret,
  encryptSecret,
  ENCRYPTED_VALUE_PREFIX,
  isEncryptedStoredValue,
} from "./credentials-encryption.js";

const TEST_KEY = Buffer.alloc(32, 9).toString("base64");
const ORIGINAL_ENV = process.env.CREDENTIALS_ENCRYPTION_KEY;

describe("credentials-encryption", () => {
  beforeEach(() => {
    process.env.CREDENTIALS_ENCRYPTION_KEY = TEST_KEY;
  });

  afterEach(() => {
    if (ORIGINAL_ENV === undefined) {
      delete process.env.CREDENTIALS_ENCRYPTION_KEY;
    } else {
      process.env.CREDENTIALS_ENCRYPTION_KEY = ORIGINAL_ENV;
    }
  });

  it("round-trips a secret through encrypt and decrypt", () => {
    const plaintext = "sk-test-secret-key-12345";
    const encrypted = encryptSecret(plaintext);

    assert.match(encrypted, new RegExp(`^${ENCRYPTED_VALUE_PREFIX}`));
    assert.notEqual(encrypted, plaintext);
    assert.equal(decryptSecret(encrypted), plaintext);
  });

  it("returns legacy plaintext values unchanged", () => {
    const legacy = "sk-legacy-plaintext-key";
    assert.equal(isEncryptedStoredValue(legacy), false);
    assert.equal(decryptSecret(legacy), legacy);
  });

  it("rejects missing or invalid encryption keys", () => {
    delete process.env.CREDENTIALS_ENCRYPTION_KEY;
    assert.throws(() => encryptSecret("value"), /CREDENTIALS_ENCRYPTION_KEY is required/);

    process.env.CREDENTIALS_ENCRYPTION_KEY = Buffer.alloc(16).toString("base64");
    assert.throws(() => encryptSecret("value"), /must decode to 32 bytes/);
  });
});
