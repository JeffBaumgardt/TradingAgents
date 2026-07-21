/**
 * apps/api/src/lib/billable-units.test.ts
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { computeBillableUnits, getModelBillableWeight } from "./billable-units.js";

describe("billable-units", () => {
  it("tilts expensive models higher than cheap ones", () => {
    assert.ok(getModelBillableWeight("anthropic", "claude-opus-4") > getModelBillableWeight("google", "gemini-flash"));
    assert.ok(getModelBillableWeight("openai", "o1") > getModelBillableWeight("openai", "gpt-4o-mini"));
  });

  it("charges hosted traffic and zeroes self-pay billable units", () => {
    assert.equal(
      computeBillableUnits({
        tokensIn: 100,
        tokensOut: 100,
        providerId: "openai",
        modelId: "gpt-4o-mini",
        costSource: "hosted",
      }),
      200,
    );
    assert.equal(
      computeBillableUnits({
        tokensIn: 1000,
        tokensOut: 1000,
        providerId: "anthropic",
        modelId: "claude-opus-4",
        costSource: "self_pay",
      }),
      0,
    );
  });
});
