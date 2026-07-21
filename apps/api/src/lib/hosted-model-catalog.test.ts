/**
 * apps/api/src/lib/hosted-model-catalog.test.ts
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  COMPUTE_CREDIT_REFERENCE_OUTPUT_USD_PER_1M,
  HOSTED_MODEL_CATALOG,
  creditMultiplierFromOutputUsdPer1M,
  getModelCreditMultiplier,
  listHostedModelCatalog,
} from "@tradingagents/api-types";

describe("hosted-model-catalog", () => {
  it("only includes text/agent models with positive prices", () => {
    assert.ok(HOSTED_MODEL_CATALOG.length >= 30);
    for (const entry of HOSTED_MODEL_CATALOG) {
      assert.ok(entry.inputUsdPer1M > 0);
      assert.ok(entry.outputUsdPer1M > 0);
      assert.ok(!/sora|dall-e|tts|whisper|embedding|imagen|veo/i.test(entry.modelId));
    }
  });

  it("normalizes multipliers from output $/1M against the credit reference rate", () => {
    assert.equal(COMPUTE_CREDIT_REFERENCE_OUTPUT_USD_PER_1M, 0.28 / 1.05);
    assert.equal(creditMultiplierFromOutputUsdPer1M(0.28 / 1.05), 1);
    assert.equal(getModelCreditMultiplier("openai", "gpt-4o-mini"), 2.3);
    assert.ok(
      getModelCreditMultiplier("anthropic", "claude-opus-4-8") >
        getModelCreditMultiplier("anthropic", "claude-haiku-4-5"),
    );
    assert.ok(
      HOSTED_MODEL_CATALOG.every((entry) =>
        ["openai", "anthropic", "google", "xai"].includes(entry.providerId),
      ),
    );
  });

  it("lists catalog entries with computed multipliers", () => {
    const listed = listHostedModelCatalog();
    assert.equal(listed.models.length, HOSTED_MODEL_CATALOG.length);
    assert.ok(listed.models.every((model) => model.creditMultiplier > 0));
  });
});
