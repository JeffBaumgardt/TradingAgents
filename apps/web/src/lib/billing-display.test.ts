/**
 * @file apps/web/src/lib/billing-display.test.ts
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  costSourceLabel,
  creditSpendTierFromMultiplier,
  estimateTypicalRunsPerMonth,
  formatComputeCredits,
  formatCreditMultiplier,
  formatCreditSpendDollars,
  formatPeriodEnd,
  formatTokenCount,
} from "./billing-display";

describe("billing-display", () => {
  it("formats counts and period end", () => {
    assert.equal(formatTokenCount(12500), "12,500");
    assert.equal(formatComputeCredits(5_000_000), "5M");
    assert.equal(formatComputeCredits(10_000_000), "10M");
    assert.equal(formatComputeCredits(2500), "2.5k");
    assert.equal(formatCreditMultiplier(17.9), "×17.9");
    assert.equal(formatCreditMultiplier(1), "×1");
    assert.match(formatPeriodEnd("2026-08-01T00:00:00.000Z"), /2026/);
  });

  it("maps multipliers onto a 1–5 dollar spend scale", () => {
    assert.equal(creditSpendTierFromMultiplier(2.3), 1);
    assert.equal(formatCreditSpendDollars(2.3), "💵");
    assert.equal(creditSpendTierFromMultiplier(16.5), 3);
    assert.equal(formatCreditSpendDollars(16.5), "💵💵💵");
    assert.equal(creditSpendTierFromMultiplier(112.5), 5);
    assert.equal(formatCreditSpendDollars(112.5), "💵💵💵💵💵");
  });

  it("estimates typical monthly runs from a multiplier", () => {
    assert.equal(estimateTypicalRunsPerMonth(2.3), 84);
    assert.equal(estimateTypicalRunsPerMonth(16.5), 11);
  });

  it("labels cost sources clearly", () => {
    assert.equal(costSourceLabel("hosted"), "Hosted");
    assert.equal(costSourceLabel("self_pay"), "Your key");
  });
});
