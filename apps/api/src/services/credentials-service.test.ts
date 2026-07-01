/**
 * apps/api/src/services/credentials-service.test.ts
 *
 * Verifies secret credentials are persisted but never returned on read paths.
 */

import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, describe, it } from "node:test";
import { SECRET_CREDENTIAL_PLACEHOLDER } from "@tradingagents/api-types";

const TEST_USER_ID = "test-user-credentials";
const TEST_API_KEY = "sk-test-secret-key-12345";

let tempDir = "";
let saveUserCredentials: typeof import("./credentials-service.js").saveUserCredentials;
let getUserCredentialsMasked: typeof import("./credentials-service.js").getUserCredentialsMasked;
let getUserCredentialsRaw: typeof import("./credentials-service.js").getUserCredentialsRaw;
let isSecretPlaceholder: typeof import("./credentials-service.js").isSecretPlaceholder;
let initializeDatabase: typeof import("../db/index.js").initializeDatabase;

before(async () => {
  tempDir = mkdtempSync(join(tmpdir(), "tradingagents-api-test-"));
  process.env.DATABASE_PATH = join(tempDir, "test.db");

  const dbModule = await import("../db/index.js");
  initializeDatabase = dbModule.initializeDatabase;
  initializeDatabase();

  const service = await import("./credentials-service.js");
  saveUserCredentials = service.saveUserCredentials;
  getUserCredentialsMasked = service.getUserCredentialsMasked;
  getUserCredentialsRaw = service.getUserCredentialsRaw;
  isSecretPlaceholder = service.isSecretPlaceholder;
});

after(() => {
  rmSync(tempDir, { recursive: true, force: true });
});

describe("credentials-service", () => {
  it("treats asterisk placeholders as unchanged secret submissions", () => {
    assert.equal(isSecretPlaceholder(SECRET_CREDENTIAL_PLACEHOLDER), true);
    assert.equal(isSecretPlaceholder("********"), true);
    assert.equal(isSecretPlaceholder("sk-live-real-key"), false);
  });

  it("stores a secret key but returns only the placeholder on read", async () => {
    await saveUserCredentials(TEST_USER_ID, {
      openai: { apiKey: TEST_API_KEY },
    });

    const masked = await getUserCredentialsMasked(TEST_USER_ID);
    assert.equal(masked.openai?.apiKey, SECRET_CREDENTIAL_PLACEHOLDER);
    assert.notEqual(masked.openai?.apiKey, TEST_API_KEY);

    const raw = await getUserCredentialsRaw(TEST_USER_ID);
    assert.equal(raw.openai?.apiKey, TEST_API_KEY);
  });

  it("does not overwrite an existing secret when the placeholder is submitted again", async () => {
    await saveUserCredentials(`${TEST_USER_ID}-preserve`, {
      openai: { apiKey: TEST_API_KEY },
    });

    await saveUserCredentials(`${TEST_USER_ID}-preserve`, {
      openai: { apiKey: SECRET_CREDENTIAL_PLACEHOLDER },
    });

    const raw = await getUserCredentialsRaw(`${TEST_USER_ID}-preserve`);
    assert.equal(raw.openai?.apiKey, TEST_API_KEY);

    const masked = await getUserCredentialsMasked(`${TEST_USER_ID}-preserve`);
    assert.equal(masked.openai?.apiKey, SECRET_CREDENTIAL_PLACEHOLDER);
    assert.notEqual(masked.openai?.apiKey, TEST_API_KEY);
  });

  it("returns non-secret fields without masking", async () => {
    await saveUserCredentials(`${TEST_USER_ID}-azure`, {
      azure: {
        apiKey: "azure-secret-key",
        endpoint: "https://example.openai.azure.com/",
        deployment: "gpt-4o",
      },
    });

    const masked = await getUserCredentialsMasked(`${TEST_USER_ID}-azure`);
    assert.equal(masked.azure?.apiKey, SECRET_CREDENTIAL_PLACEHOLDER);
    assert.equal(masked.azure?.endpoint, "https://example.openai.azure.com/");
    assert.equal(masked.azure?.deployment, "gpt-4o");
  });
});
