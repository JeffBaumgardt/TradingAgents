/**
 * @file apps/web/src/lib/provider-api-key-link.test.ts
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  getProviderApiKeyLinkHint,
  getProviderApiKeyLinkLabel,
  resolveProviderApiKeyUrl,
} from "./provider-api-key-link";

describe("resolveProviderApiKeyUrl", () => {
  it("accepts https URLs from the credentials schema", () => {
    assert.equal(
      resolveProviderApiKeyUrl("https://console.x.ai/team/default/api-keys"),
      "https://console.x.ai/team/default/api-keys",
    );
  });

  it("rejects missing or non-https URLs", () => {
    assert.equal(resolveProviderApiKeyUrl(undefined), null);
    assert.equal(resolveProviderApiKeyUrl(null), null);
    assert.equal(resolveProviderApiKeyUrl("http://example.com"), null);
    assert.equal(resolveProviderApiKeyUrl("javascript:alert(1)"), null);
  });
});

describe("getProviderApiKeyLinkLabel", () => {
  it("uses Azure-specific setup copy", () => {
    assert.equal(getProviderApiKeyLinkLabel("azure"), "Set up in Azure portal");
    assert.equal(getProviderApiKeyLinkLabel("xai"), "Get an API key");
  });
});

describe("getProviderApiKeyLinkHint", () => {
  it("explains Azure endpoint and deployment requirements", () => {
    assert.match(
      getProviderApiKeyLinkHint("azure") ?? "",
      /endpoint/i,
    );
    assert.equal(getProviderApiKeyLinkHint("xai"), null);
  });
});
