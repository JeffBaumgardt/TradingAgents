/**
 * apps/api/src/services/billing-service.test.ts
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ANNUAL_DISCOUNT_PERCENT,
  BillingServiceError,
  createCheckoutSession,
  listBillingPlans,
} from "./billing-service.js";

describe("billing-service", () => {
  it("lists BYOK and hosted plans with a 20% annual discount", () => {
    const { plans } = listBillingPlans();
    assert.equal(plans.length, 2);
    assert.equal(ANNUAL_DISCOUNT_PERCENT, 20);
    assert.equal(plans[0]?.id, "byok");
    assert.equal(plans[0]?.monthlyPriceCents, 300);
    assert.equal(plans[1]?.id, "hosted");
    assert.equal(plans[1]?.priceProvisional, true);
  });

  it("returns a not_configured checkout scaffold for valid requests", () => {
    const result = createCheckoutSession({
      planId: "byok",
      interval: "annual",
      successUrl: "https://example.com/success",
      cancelUrl: "https://example.com/cancel",
    });

    assert.equal(result.status, "not_configured");
    assert.equal(result.planId, "byok");
    assert.equal(result.interval, "annual");
    assert.equal(result.checkoutUrl, null);
    assert.match(result.message, /scaffolded/i);
  });

  it("rejects invalid checkout payloads", () => {
    assert.throws(
      () => createCheckoutSession({ planId: "enterprise", interval: "monthly" }),
      (error: unknown) =>
        error instanceof BillingServiceError && error.status === 400,
    );
    assert.throws(
      () => createCheckoutSession({ planId: "byok", interval: "weekly" }),
      (error: unknown) =>
        error instanceof BillingServiceError && error.status === 400,
    );
    assert.throws(
      () => createCheckoutSession(null),
      (error: unknown) =>
        error instanceof BillingServiceError && error.status === 400,
    );
  });
});
