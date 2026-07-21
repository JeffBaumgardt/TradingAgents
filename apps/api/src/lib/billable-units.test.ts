/**
 * apps/api/src/lib/billable-units.test.ts
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getModelCreditMultiplier } from "@tradingagents/api-types";
import { computeCredits } from "./billable-units.js";

describe("billable-units / compute credits", () => {
  it("gives cheaper output models a lower multiplier than frontier models", () => {
    const flash = getModelCreditMultiplier("deepseek", "deepseek-v4-flash");
    const haiku = getModelCreditMultiplier("anthropic", "claude-haiku-4-5");
    const opus = getModelCreditMultiplier("anthropic", "claude-opus-4-8");
    assert.equal(flash, 1);
    assert.ok(haiku > flash);
    assert.ok(opus > haiku);
  });

  it("charges hosted traffic and zeroes self-pay compute credits", () => {
    assert.equal(
      computeCredits({
        tokensIn: 100,
        tokensOut: 100,
        providerId: "deepseek",
        modelId: "deepseek-v4-flash",
        costSource: "hosted",
      }),
      200,
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
