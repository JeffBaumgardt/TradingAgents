/**
 * apps/api/src/services/credentials-service.test.ts
 *
 * Verifies secret credentials are encrypted at rest and never returned on read paths.
 */

import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { SECRET_CREDENTIAL_PLACEHOLDER } from "@tradingagents/api-types";
import { createInMemorySupabase } from "@tradingagents/supabase/test";
import { ENCRYPTED_VALUE_PREFIX } from "../lib/credentials-encryption.js";
import { TEST_CREDENTIALS_ENCRYPTION_KEY } from "../lib/test-credentials-encryption-key.js";
import {
  getStoredCredentialFieldValue,
  getUserCredentialsMasked,
  getUserCredentialsRaw,
  isSecretPlaceholder,
  saveUserCredentials,
} from "./credentials-service.js";

const TEST_USER_ID = "test-user-credentials";
const TEST_API_KEY = "sk-test-secret-key-12345";
const ORIGINAL_ENV = process.env.CREDENTIALS_ENCRYPTION_KEY;

describe("credentials-service", () => {
  beforeEach(() => {
    process.env.CREDENTIALS_ENCRYPTION_KEY = TEST_CREDENTIALS_ENCRYPTION_KEY;
  });

  afterEach(() => {
    if (ORIGINAL_ENV === undefined) {
      delete process.env.CREDENTIALS_ENCRYPTION_KEY;
    } else {
      process.env.CREDENTIALS_ENCRYPTION_KEY = ORIGINAL_ENV;
    }
  });

  it("treats asterisk placeholders as unchanged secret submissions", () => {
    assert.equal(isSecretPlaceholder(SECRET_CREDENTIAL_PLACEHOLDER), true);
    assert.equal(isSecretPlaceholder("********"), true);
    assert.equal(isSecretPlaceholder("sk-live-real-key"), false);
  });

  it("stores a secret key encrypted but returns plaintext on internal read", async () => {
    const client = createInMemorySupabase();
    await saveUserCredentials(client, TEST_USER_ID, {
      openai: { apiKey: TEST_API_KEY },
    });

    const stored = await getStoredCredentialFieldValue(
      client,
      TEST_USER_ID,
      "openai",
      "apiKey",
    );
    assert.ok(stored);
    assert.match(stored, new RegExp(`^${ENCRYPTED_VALUE_PREFIX}`));
    assert.notEqual(stored, TEST_API_KEY);

    const masked = await getUserCredentialsMasked(client, TEST_USER_ID);
    assert.equal(masked.openai?.apiKey, SECRET_CREDENTIAL_PLACEHOLDER);
    assert.notEqual(masked.openai?.apiKey, TEST_API_KEY);

    const raw = await getUserCredentialsRaw(client, TEST_USER_ID);
    assert.equal(raw.openai?.apiKey, TEST_API_KEY);
  });

  it("does not overwrite an existing secret when the placeholder is submitted again", async () => {
    const client = createInMemorySupabase();
    await saveUserCredentials(client, `${TEST_USER_ID}-preserve`, {
      openai: { apiKey: TEST_API_KEY },
    });

    await saveUserCredentials(client, `${TEST_USER_ID}-preserve`, {
      openai: { apiKey: SECRET_CREDENTIAL_PLACEHOLDER },
    });

    const raw = await getUserCredentialsRaw(client, `${TEST_USER_ID}-preserve`);
    assert.equal(raw.openai?.apiKey, TEST_API_KEY);

    const masked = await getUserCredentialsMasked(client, `${TEST_USER_ID}-preserve`);
    assert.equal(masked.openai?.apiKey, SECRET_CREDENTIAL_PLACEHOLDER);
    assert.notEqual(masked.openai?.apiKey, TEST_API_KEY);
  });

  it("returns non-secret fields without masking or encryption", async () => {
    const client = createInMemorySupabase();
    await saveUserCredentials(client, `${TEST_USER_ID}-azure`, {
      azure: {
        apiKey: "azure-secret-key",
        endpoint: "https://example.openai.azure.com/",
        deployment: "gpt-4o",
      },
    });

    const storedEndpoint = await getStoredCredentialFieldValue(
      client,
      `${TEST_USER_ID}-azure`,
      "azure",
      "endpoint",
    );
    assert.equal(storedEndpoint, "https://example.openai.azure.com/");

    const storedSecret = await getStoredCredentialFieldValue(
      client,
      `${TEST_USER_ID}-azure`,
      "azure",
      "apiKey",
    );
    assert.ok(storedSecret);
    assert.match(storedSecret, new RegExp(`^${ENCRYPTED_VALUE_PREFIX}`));

    const masked = await getUserCredentialsMasked(client, `${TEST_USER_ID}-azure`);
    assert.equal(masked.azure?.apiKey, SECRET_CREDENTIAL_PLACEHOLDER);
    assert.equal(masked.azure?.endpoint, "https://example.openai.azure.com/");
    assert.equal(masked.azure?.deployment, "gpt-4o");
  });

  it("re-encrypts legacy plaintext secrets on read", async () => {
    const client = createInMemorySupabase();
    const userId = `${TEST_USER_ID}-legacy`;
    const now = new Date().toISOString();

    await client.from("user_credentials").upsert(
      {
        user_id: userId,
        provider_id: "openai",
        field_name: "apiKey",
        field_value: TEST_API_KEY,
        updated_at: now,
      },
      { onConflict: "user_id,provider_id,field_name" },
    );

    const raw = await getUserCredentialsRaw(client, userId);
    assert.equal(raw.openai?.apiKey, TEST_API_KEY);

    const stored = await getStoredCredentialFieldValue(client, userId, "openai", "apiKey");
    assert.ok(stored);
    assert.match(stored, new RegExp(`^${ENCRYPTED_VALUE_PREFIX}`));
    assert.notEqual(stored, TEST_API_KEY);
  });
});
