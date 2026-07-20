/**
 * @file apps/web/src/lib/pricing-content.test.ts
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ANNUAL_DISCOUNT_PERCENT,
  annualMonthlyEquivalentCents,
  annualTotalCents,
  buildCheckoutHref,
  displayPriceCents,
  formatUsdFromCents,
  getPricingPlan,
  isBillingInterval,
  isPricingPlanId,
  PRICING_PLANS,
} from "./pricing-content";

describe("pricing-content", () => {
  it("applies a 20% annual discount to the BYOK plan", () => {
    const byok = getPricingPlan("byok");
    assert.equal(ANNUAL_DISCOUNT_PERCENT, 20);
    assert.equal(byok.monthlyPriceCents, 300);
    assert.equal(annualTotalCents(byok.monthlyPriceCents), 2880);
    assert.equal(annualMonthlyEquivalentCents(byok.monthlyPriceCents), 240);
    assert.equal(displayPriceCents(byok, "monthly"), 300);
    assert.equal(displayPriceCents(byok, "annual"), 240);
  });

  it("marks hosted pricing as provisional with a higher list rate", () => {
    const hosted = getPricingPlan("hosted");
    assert.equal(hosted.priceProvisional, true);
    assert.ok(hosted.monthlyPriceCents > getPricingPlan("byok").monthlyPriceCents);
  });

  it("formats currency and checkout hrefs", () => {
    assert.equal(formatUsdFromCents(300), "$3");
    assert.equal(formatUsdFromCents(240), "$2.40");
    assert.equal(buildCheckoutHref("byok", "annual"), "/checkout?plan=byok&interval=annual");
  });

  it("validates plan and interval ids", () => {
    assert.equal(isPricingPlanId("byok"), true);
    assert.equal(isPricingPlanId("enterprise"), false);
    assert.equal(isBillingInterval("monthly"), true);
    assert.equal(isBillingInterval("weekly"), false);
    assert.equal(PRICING_PLANS.length, 2);
  });
});
