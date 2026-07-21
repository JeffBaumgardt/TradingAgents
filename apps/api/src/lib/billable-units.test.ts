/**
 * apps/api/src/lib/billable-units.test.ts
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  creditMultiplierFromOutputUsdPer1M,
  getHostedModelCostEntry,
  getModelCreditMultiplier,
} from "@tradingagents/api-types";
import { computeCredits } from "./billable-units.js";

describe("billable-units / compute credits", () => {
  it("gives cheaper output models a lower multiplier than frontier models", () => {
    const mini = getModelCreditMultiplier("openai", "gpt-4o-mini");
    const haiku = getModelCreditMultiplier("anthropic", "claude-haiku-4-5");
    const opus = getModelCreditMultiplier("anthropic", "claude-opus-4-8");
    const expectedMini = creditMultiplierFromOutputUsdPer1M(
      getHostedModelCostEntry("openai", "gpt-4o-mini")!.outputUsdPer1M,
    );
    assert.equal(mini, expectedMini);
    assert.ok(haiku > mini);
    assert.ok(opus > haiku);
  });

  it("charges hosted traffic and zeroes self-pay compute credits", () => {
    const miniMultiplier = getModelCreditMultiplier("openai", "gpt-4o-mini");
    assert.equal(
      computeCredits({
        tokensIn: 100,
        tokensOut: 100,
        providerId: "openai",
        modelId: "gpt-4o-mini",
        costSource: "hosted",
      }),
      Math.round(200 * miniMultiplier),
    );
    assert.equal(
      computeCredits({
        tokensIn: 1000,
        tokensOut: 1000,
        providerId: "anthropic",
        modelId: "claude-opus-4-8",
        costSource: "self_pay",
      }),
      0,
    );
    assert.ok(
      computeCredits({
        tokensIn: 100,
        tokensOut: 100,
        providerId: "anthropic",
        modelId: "claude-opus-4-8",
        costSource: "hosted",
      }) >
        computeCredits({
          tokensIn: 100,
          tokensOut: 100,
          providerId: "anthropic",
          modelId: "claude-haiku-4-5",
          costSource: "hosted",
        }),
    );
  });
});
