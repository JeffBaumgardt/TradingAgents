/**
 * apps/api/src/lib/billable-units.test.ts
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  AGENTS_MODEL_ID,
  AGENTS_MODEL_OUTPUT_CREDITS_PER_TOKEN,
  AGENTS_MODEL_PROVIDER_ID,
  COMPUTE_CREDIT_MARGIN,
  PRO_MONTHLY_COMPUTE_CREDIT_ALLOWANCE,
  computeAgentsModelCredits,
  getHostedModelCostEntry,
} from "@tradingagents/api-types";
import { computeCredits } from "./billable-units.js";

describe("billable-units / compute credits", () => {
  it("uses $2 input / $10 output list prices for Agents Model", () => {
    const agents = getHostedModelCostEntry(AGENTS_MODEL_PROVIDER_ID, AGENTS_MODEL_ID);
    assert.ok(agents);
    assert.equal(agents.inputUsdPer1M, 2);
    assert.equal(agents.outputUsdPer1M, 10);
    assert.equal(AGENTS_MODEL_OUTPUT_CREDITS_PER_TOKEN, 5);
  });

  it("charges 1 credit per input token and 5 per output token, plus margin", () => {
    assert.equal(
      computeCredits({
        tokensIn: 100,
        tokensOut: 100,
        providerId: AGENTS_MODEL_PROVIDER_ID,
        modelId: AGENTS_MODEL_ID,
      }),
      Math.round((100 * 1 + 100 * 5) * COMPUTE_CREDIT_MARGIN),
    );
  });

  it("maps 10M credits to about 2M output tokens after margin", () => {
    const creditsForTwoMillionOutput = computeAgentsModelCredits(0, 2_000_000);
    assert.equal(creditsForTwoMillionOutput, Math.round(2_000_000 * 5 * COMPUTE_CREDIT_MARGIN));
    assert.ok(Math.abs(creditsForTwoMillionOutput - PRO_MONTHLY_COMPUTE_CREDIT_ALLOWANCE) < 600_000);
  });
});
