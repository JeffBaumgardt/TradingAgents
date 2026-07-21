/**
 * @file apps/web/src/lib/billing-display.test.ts
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  costSourceLabel,
  formatComputeCredits,
  formatCreditMultiplier,
  formatPeriodEnd,
  formatTokenCount,
} from "./billing-display";

describe("billing-display", () => {
  it("formats counts and period end", () => {
    assert.equal(formatTokenCount(12500), "12,500");
    assert.equal(formatComputeCredits(5_000_000), "5M");
    assert.equal(formatComputeCredits(2500), "2.5k");
    assert.equal(formatCreditMultiplier(17.9), "×17.9");
    assert.equal(formatCreditMultiplier(1), "×1");
    assert.match(formatPeriodEnd("2026-08-01T00:00:00.000Z"), /2026/);
  });

  it("labels cost sources clearly", () => {
    assert.equal(costSourceLabel("hosted"), "Hosted");
    assert.equal(costSourceLabel("self_pay"), "Your key");
  });
});
