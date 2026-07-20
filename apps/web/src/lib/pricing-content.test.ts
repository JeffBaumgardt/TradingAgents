/**
 * @file apps/web/src/lib/pricing-content.test.ts
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  BILLING_ANNUAL_DISCOUNT_PERCENT,
  BILLING_CATALOG,
} from "@tradingagents/api-types";
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
  it("uses the shared billing catalog for plan cents", () => {
    assert.equal(ANNUAL_DISCOUNT_PERCENT, BILLING_ANNUAL_DISCOUNT_PERCENT);
    assert.equal(PRICING_PLANS.length, BILLING_CATALOG.length);
    assert.equal(PRICING_PLANS[0]?.monthlyPriceCents, BILLING_CATALOG[0]?.monthlyPriceCents);
    assert.equal(PRICING_PLANS[1]?.monthlyPriceCents, BILLING_CATALOG[1]?.monthlyPriceCents);
  });

  it("applies a 20% annual discount to the BYOK plan", () => {
    const byok = getPricingPlan("byok");
    assert.equal(byok.monthlyPriceCents, 300);
    assert.equal(annualTotalCents(byok.monthlyPriceCents), 2880);
    assert.equal(annualMonthlyEquivalentCents(byok.monthlyPriceCents), 240);
    assert.equal(displayPriceCents(byok, "monthly"), 300);
    assert.equal(displayPriceCents(byok, "annual"), 240);
  });

  it("applies a 20% annual discount to the provisional hosted plan", () => {
    const hosted = getPricingPlan("hosted");
    assert.equal(hosted.priceProvisional, true);
    assert.equal(annualTotalCents(hosted.monthlyPriceCents), 27840);
    assert.equal(annualMonthlyEquivalentCents(hosted.monthlyPriceCents), 2320);
    assert.equal(formatUsdFromCents(2320), "$23.20");
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
  });
});
