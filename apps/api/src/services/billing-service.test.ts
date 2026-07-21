/**
 * apps/api/src/services/billing-service.test.ts
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  BILLING_ANNUAL_DISCOUNT_PERCENT,
  BILLING_CATALOG,
} from "@tradingagents/api-types";
import {
  BillingServiceError,
  createCheckoutSession,
  listBillingPlans,
} from "./billing-service.js";

describe("billing-service", () => {
  it("lists the shared BYOK and hosted catalog", () => {
    const { plans } = listBillingPlans();
    assert.deepEqual(plans, [...BILLING_CATALOG]);
    assert.equal(BILLING_ANNUAL_DISCOUNT_PERCENT, 20);
    assert.equal(plans[0]?.monthlyPriceCents, 300);
    assert.equal(plans[1]?.priceProvisional, false);
  });

  it("returns a not_configured checkout scaffold for valid requests", async () => {
    const result = await createCheckoutSession({
      planId: "byok",
      interval: "annual",
    });

    assert.equal(result.status, "not_configured");
    assert.equal(result.planId, "byok");
    assert.equal(result.interval, "annual");
    assert.equal(result.checkoutUrl, null);
    assert.equal(result.subscriptionActivated, false);
    assert.match(result.message, /scaffolded/i);
  });

  it("rejects client-supplied redirect URLs", async () => {
    await assert.rejects(
      () =>
        createCheckoutSession({
          planId: "byok",
          interval: "monthly",
          successUrl: "https://evil.example/phish",
        }),
      (error: unknown) =>
        error instanceof BillingServiceError && error.status === 400,
    );
  });

  it("rejects invalid checkout payloads", async () => {
    await assert.rejects(
      () => createCheckoutSession({ planId: "enterprise", interval: "monthly" }),
      (error: unknown) =>
        error instanceof BillingServiceError && error.status === 400,
    );
    await assert.rejects(
      () => createCheckoutSession({ planId: "byok", interval: "weekly" }),
      (error: unknown) =>
        error instanceof BillingServiceError && error.status === 400,
    );
    await assert.rejects(
      () => createCheckoutSession(null),
      (error: unknown) =>
        error instanceof BillingServiceError && error.status === 400,
    );
  });
});
