/**
 * @file apps/web/src/lib/billing-display.test.ts
 */

import { describe, it, expect } from "vitest";
import {
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
    expect(formatTokenCount(12500)).toBe("12,500");
    expect(formatComputeCredits(5_000_000)).toBe("5M");
    expect(formatComputeCredits(10_000_000)).toBe("10M");
    expect(formatComputeCredits(2500)).toBe("2.5k");
    expect(formatCreditMultiplier(17.9)).toBe("×17.9");
    expect(formatCreditMultiplier(1)).toBe("×1");
    expect(formatPeriodEnd("2026-08-01T00:00:00.000Z")).toMatch(/2026/);
  });

  it("maps multipliers onto a 1–5 dollar spend scale", () => {
    expect(creditSpendTierFromMultiplier(2.3)).toBe(1);
    expect(formatCreditSpendDollars(2.3)).toBe("💵");
    expect(creditSpendTierFromMultiplier(16.5)).toBe(3);
    expect(formatCreditSpendDollars(16.5)).toBe("💵💵💵");
    expect(creditSpendTierFromMultiplier(112.5)).toBe(5);
    expect(formatCreditSpendDollars(112.5)).toBe("💵💵💵💵💵");
  });

  it("estimates typical monthly runs from a multiplier", () => {
    expect(estimateTypicalRunsPerMonth(2.3)).toBe(46);
    expect(estimateTypicalRunsPerMonth(16.5)).toBe(6);
  });

});

