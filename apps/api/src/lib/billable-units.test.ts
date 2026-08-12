/**
 * apps/api/src/lib/billable-units.test.ts
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  AGENTS_MODEL_ID,
  AGENTS_MODEL_PROVIDER_ID,
  creditMultiplierFromOutputUsdPer1M,
  getHostedModelCostEntry,
  getModelCreditMultiplier,
} from "@tradingagents/api-types";
import { computeCredits } from "./billable-units.js";

describe("billable-units / compute credits", () => {
  it("meters Agents Model against its catalog output price", () => {
    const agents = getHostedModelCostEntry(AGENTS_MODEL_PROVIDER_ID, AGENTS_MODEL_ID);
    assert.ok(agents);
    const multiplier = getModelCreditMultiplier(AGENTS_MODEL_PROVIDER_ID, AGENTS_MODEL_ID);
    assert.equal(multiplier, 1);
    assert.ok(creditMultiplierFromOutputUsdPer1M(agents.outputUsdPer1M) > 1);
  });

  it("charges hosted traffic and zeroes self-pay compute credits", () => {
    const multiplier = getModelCreditMultiplier(AGENTS_MODEL_PROVIDER_ID, AGENTS_MODEL_ID);
    assert.equal(
      computeCredits({
        tokensIn: 100,
        tokensOut: 100,
        providerId: AGENTS_MODEL_PROVIDER_ID,
        modelId: AGENTS_MODEL_ID,
        costSource: "hosted",
      }),
      Math.round(200 * multiplier),
    );
    assert.equal(
      computeCredits({
        tokensIn: 1000,
        tokensOut: 1000,
        providerId: AGENTS_MODEL_PROVIDER_ID,
        modelId: AGENTS_MODEL_ID,
        costSource: "self_pay",
      }),
      0,
    );
  });
});
