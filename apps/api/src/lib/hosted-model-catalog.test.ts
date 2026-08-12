/**
 * apps/api/src/lib/hosted-model-catalog.test.ts
 */

import assert from "node:assert/strict";
import { describe, it } from "vitest";
import {
  AGENTS_MODEL_ID,
  AGENTS_MODEL_INPUT_USD_PER_1M,
  AGENTS_MODEL_OUTPUT_USD_PER_1M,
  AGENTS_MODEL_PROVIDER_ID,
  COMPUTE_CREDIT_MARGIN,
  COMPUTE_CREDIT_REFERENCE_OUTPUT_USD_PER_1M,
  HOSTED_MODEL_CATALOG,
  computeAgentsModelCredits,
  getAgentsModelCreditRates,
  getModelCreditMultiplier,
  listHostedModelCatalog,
} from "@tradingagents/api-types";

describe("hosted-model-catalog", () => {
  it("only includes Agents Model with $2/$10 list prices", () => {
    assert.equal(HOSTED_MODEL_CATALOG.length, 1);
    for (const entry of HOSTED_MODEL_CATALOG) {
      assert.equal(entry.inputUsdPer1M, AGENTS_MODEL_INPUT_USD_PER_1M);
      assert.equal(entry.outputUsdPer1M, AGENTS_MODEL_OUTPUT_USD_PER_1M);
      assert.equal(entry.providerId, "anthropic");
      assert.equal(entry.modelId, AGENTS_MODEL_ID);
    }
    assert.equal(COMPUTE_CREDIT_REFERENCE_OUTPUT_USD_PER_1M, 10);
  });

  it("bills weighted credits with 5% margin", () => {
    const rates = getAgentsModelCreditRates();
    assert.equal(rates.inputCreditsPerToken, 1 * COMPUTE_CREDIT_MARGIN);
    assert.equal(rates.outputCreditsPerToken, 5 * COMPUTE_CREDIT_MARGIN);
    assert.equal(computeAgentsModelCredits(0, 2_000_000), Math.round(10_000_000 * COMPUTE_CREDIT_MARGIN));
    assert.equal(getModelCreditMultiplier(AGENTS_MODEL_PROVIDER_ID, AGENTS_MODEL_ID), 5);
  });

  it("lists catalog entries with in/out credit rates", () => {
    const listed = listHostedModelCatalog();
    assert.equal(listed.models.length, HOSTED_MODEL_CATALOG.length);
    assert.equal(listed.referenceOutputUsdPer1M, 10);
    assert.ok(listed.models.every((model) => model.outputCreditsPerToken > model.inputCreditsPerToken));
  });
});
