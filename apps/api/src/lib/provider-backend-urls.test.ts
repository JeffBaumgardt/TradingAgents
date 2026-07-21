/**
 * apps/api/src/lib/provider-backend-urls.test.ts
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  canonicalBackendUrlForProvider,
  isCanonicalHostedProvider,
} from "./provider-backend-urls.js";

describe("provider-backend-urls", () => {
  it("pins official vendor endpoints for hosted providers", () => {
    assert.equal(
      canonicalBackendUrlForProvider("openai"),
      "https://api.openai.com/v1",
    );
    assert.equal(
      canonicalBackendUrlForProvider("Anthropic"),
      "https://api.anthropic.com/",
    );
    assert.equal(canonicalBackendUrlForProvider("google"), null);
    assert.equal(canonicalBackendUrlForProvider("xai"), "https://api.x.ai/v1");
    assert.equal(isCanonicalHostedProvider("openai"), true);
    assert.equal(isCanonicalHostedProvider("ollama"), false);
  });
});
