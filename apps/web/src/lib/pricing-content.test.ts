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

  it("applies a 20% annual discount to the Standard plan", () => {
    const standard = getPricingPlan("standard");
    assert.equal(standard.monthlyPriceCents, 900);
    assert.equal(annualTotalCents(standard.monthlyPriceCents), 8640);
    assert.equal(annualMonthlyEquivalentCents(standard.monthlyPriceCents), 720);
    assert.equal(displayPriceCents(standard, "monthly"), 900);
    assert.equal(displayPriceCents(standard, "annual"), 720);
  });

  it("applies a 20% annual discount to the Pro plan", () => {
    const pro = getPricingPlan("pro");
    assert.equal(pro.monthlyPriceCents, 1900);
    assert.equal(pro.priceProvisional, false);
    assert.equal(annualTotalCents(pro.monthlyPriceCents), 18240);
    assert.equal(annualMonthlyEquivalentCents(pro.monthlyPriceCents), 1520);
    assert.equal(formatUsdFromCents(1520), "$15.20");
    assert.ok(
      pro.highlights.some((item) => /10M compute credits per month/i.test(item)),
    );
  });

  it("formats currency and checkout hrefs", () => {
    assert.equal(formatUsdFromCents(900), "$9");
    assert.equal(formatUsdFromCents(720), "$7.20");
    assert.equal(buildCheckoutHref("standard", "annual"), "/checkout?plan=standard&interval=annual");
  });

  it("validates plan and interval ids", () => {
    assert.equal(isPricingPlanId("standard"), true);
    assert.equal(isPricingPlanId("pro"), true);
    assert.equal(isPricingPlanId("enterprise"), false);
    assert.equal(isBillingInterval("monthly"), true);
    assert.equal(isBillingInterval("weekly"), false);
  });
});
