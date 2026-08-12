/**
 * @file apps/web/src/lib/pricing-content.test.ts
 */

import { describe, it, expect } from "vitest";
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
    expect(ANNUAL_DISCOUNT_PERCENT).toBe(BILLING_ANNUAL_DISCOUNT_PERCENT);
    expect(PRICING_PLANS.length).toBe(BILLING_CATALOG.length);
    expect(PRICING_PLANS[0]?.monthlyPriceCents).toBe(BILLING_CATALOG[0]?.monthlyPriceCents);
    expect(PRICING_PLANS[1]?.monthlyPriceCents).toBe(BILLING_CATALOG[1]?.monthlyPriceCents);
  });

  it("applies a 20% annual discount to the Standard plan", () => {
    const standard = getPricingPlan("standard");
    expect(standard.monthlyPriceCents).toBe(900);
    expect(annualTotalCents(standard.monthlyPriceCents)).toBe(8640);
    expect(annualMonthlyEquivalentCents(standard.monthlyPriceCents)).toBe(720);
    expect(displayPriceCents(standard, "monthly")).toBe(900);
    expect(displayPriceCents(standard, "annual")).toBe(720);
  });

  it("applies a 20% annual discount to the Pro plan", () => {
    const pro = getPricingPlan("pro");
    expect(pro.monthlyPriceCents).toBe(1900);
    expect(pro.priceProvisional).toBe(false);
    expect(annualTotalCents(pro.monthlyPriceCents)).toBe(18240);
    expect(annualMonthlyEquivalentCents(pro.monthlyPriceCents)).toBe(1520);
    expect(formatUsdFromCents(1520)).toBe("$15.20");
    expect(pro.highlights.some((item) => /10M compute credits per month/i.test(item))).toBeTruthy();
  });

  it("formats currency and checkout hrefs", () => {
    expect(formatUsdFromCents(900)).toBe("$9");
    expect(formatUsdFromCents(720)).toBe("$7.20");
    expect(buildCheckoutHref("standard", "annual")).toBe("/checkout?plan=standard&interval=annual");
  });

  it("validates plan and interval ids", () => {
    expect(isPricingPlanId("standard")).toBe(true);
    expect(isPricingPlanId("pro")).toBe(true);
    expect(isPricingPlanId("enterprise")).toBe(false);
    expect(isBillingInterval("monthly")).toBe(true);
    expect(isBillingInterval("weekly")).toBe(false);
  });
});
