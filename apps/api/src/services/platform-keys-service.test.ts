/**
 * apps/api/src/services/platform-keys-service.test.ts
 */

import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { createInMemorySupabase } from "@tradingagents/supabase/test";
import { ENCRYPTED_VALUE_PREFIX } from "../lib/credentials-encryption.js";
import { TEST_CREDENTIALS_ENCRYPTION_KEY } from "../lib/test-credentials-encryption-key.js";
import {
  getPlatformApiKeyPlaintext,
  resolveRunProviderCredentials,
  upsertPlatformApiKey,
} from "./platform-keys-service.js";

const ORIGINAL_ENV = process.env.CREDENTIALS_ENCRYPTION_KEY;

describe("platform-keys-service", () => {
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

  it("stores platform keys encrypted and decrypts for internal use only", async () => {
    const client = createInMemorySupabase();
    await upsertPlatformApiKey(client, {
      providerId: "openai",
      apiKey: "sk-platform-secret",
      label: "prod",
    });

    const { data } = await client
      .from("platform_api_keys")
      .select("encrypted_api_key")
      .eq("provider_id", "openai")
      .maybeSingle();

    assert.ok(data);
    assert.ok(
      String((data as { encrypted_api_key: string }).encrypted_api_key).startsWith(
        ENCRYPTED_VALUE_PREFIX,
      ),
    );
    assert.equal(await getPlatformApiKeyPlaintext(client, "openai"), "sk-platform-secret");
  });

  it("prefers user BYOK keys (self_pay) over platform keys", async () => {
    const client = createInMemorySupabase();
    await upsertPlatformApiKey(client, {
      providerId: "anthropic",
      apiKey: "sk-platform",
    });

    const resolved = await resolveRunProviderCredentials(
      client,
      { anthropic: { apiKey: "sk-user" } },
      {
        isHostedPlan: true,
        hostedProviderIds: ["anthropic"],
        selectedProviderId: "anthropic",
      },
    );

    assert.equal(resolved.costSource, "self_pay");
    assert.equal(resolved.usedPlatformKey, false);
    assert.equal(resolved.credentials.anthropic?.apiKey, "sk-user");
  });

  it("injects platform keys for hosted providers without user keys", async () => {
    const client = createInMemorySupabase();
    await upsertPlatformApiKey(client, {
      providerId: "openai",
      apiKey: "sk-platform-openai",
    });

    const resolved = await resolveRunProviderCredentials(
      client,
      {},
      {
        isHostedPlan: true,
        hostedProviderIds: ["openai"],
        selectedProviderId: "openai",
      },
    );

    assert.equal(resolved.costSource, "hosted");
    assert.equal(resolved.usedPlatformKey, true);
    assert.equal(resolved.credentials.openai?.apiKey, "sk-platform-openai");
  });
});
