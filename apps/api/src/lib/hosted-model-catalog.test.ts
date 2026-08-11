/**
 * apps/api/src/lib/hosted-model-catalog.test.ts
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  AGENTS_MODEL_ID,
  AGENTS_MODEL_PROVIDER_ID,
  COMPUTE_CREDIT_REFERENCE_OUTPUT_USD_PER_1M,
  HOSTED_MODEL_CATALOG,
  creditMultiplierFromOutputUsdPer1M,
  getModelCreditMultiplier,
  listHostedModelCatalog,
} from "@tradingagents/api-types";

describe("hosted-model-catalog", () => {
  it("only includes Agents Model with positive prices", () => {
    assert.equal(HOSTED_MODEL_CATALOG.length, 1);
    for (const entry of HOSTED_MODEL_CATALOG) {
      assert.ok(entry.inputUsdPer1M > 0);
      assert.ok(entry.outputUsdPer1M > 0);
      assert.equal(entry.providerId, "anthropic");
      assert.equal(entry.modelId, AGENTS_MODEL_ID);
    }
  });

  it("normalizes multipliers from output $/1M against the credit reference rate", () => {
    assert.equal(COMPUTE_CREDIT_REFERENCE_OUTPUT_USD_PER_1M, 0.28 / 1.05);
    assert.equal(creditMultiplierFromOutputUsdPer1M(0.28 / 1.05), 1);
    assert.equal(
      getModelCreditMultiplier(AGENTS_MODEL_PROVIDER_ID, AGENTS_MODEL_ID),
      creditMultiplierFromOutputUsdPer1M(10),
    );
  });

  it("lists catalog entries with computed multipliers", () => {
    const listed = listHostedModelCatalog();
    assert.equal(listed.models.length, HOSTED_MODEL_CATALOG.length);
    assert.ok(listed.models.every((model) => model.creditMultiplier > 0));
  });
});
