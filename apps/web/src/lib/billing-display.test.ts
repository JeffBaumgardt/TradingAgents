/**
 * @file apps/web/src/lib/billing-display.test.ts
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  costSourceLabel,
  formatBillableUnits,
  formatPeriodEnd,
  formatTokenCount,
} from "./billing-display";

describe("billing-display", () => {
  it("formats counts and period end", () => {
    assert.equal(formatTokenCount(12500), "12,500");
    assert.equal(formatBillableUnits(5_000_000), "5M");
    assert.equal(formatBillableUnits(2500), "2.5k");
    assert.match(formatPeriodEnd("2026-08-01T00:00:00.000Z"), /2026/);
  });

  it("labels cost sources clearly", () => {
    assert.equal(costSourceLabel("self_pay"), "Your key");
    assert.equal(costSourceLabel("hosted"), "Hosted");
  });
});
