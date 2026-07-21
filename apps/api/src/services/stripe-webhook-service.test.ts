/**
 * apps/api/src/services/stripe-webhook-service.test.ts
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createInMemorySupabase } from "@tradingagents/supabase/test";
import type Stripe from "stripe";
import { handleCheckoutSessionCompleted } from "./stripe-webhook-service.js";
import { getBillingAccount } from "./billing-account-service.js";

function sessionFixture(
  overrides: Partial<Stripe.Checkout.Session> = {},
): Stripe.Checkout.Session {
  return {
    id: "cs_test_123",
    object: "checkout.session",
    mode: "subscription",
    client_reference_id: "user_abc",
    customer: "cus_abc",
    // Omit subscription id so unit tests do not call Stripe to load period dates.
    subscription: null,
    metadata: {
      planId: "byok",
      interval: "monthly",
      userId: "user_abc",
    },
    ...overrides,
  } as Stripe.Checkout.Session;
}

describe("stripe-webhook-service", () => {
  it("activates a paid subscription from checkout.session.completed", async () => {
    const client = createInMemorySupabase();
    const result = await handleCheckoutSessionCompleted(client, sessionFixture());

    assert.equal(result.activated, true);
    const account = await getBillingAccount(client, "user_abc");
    assert.equal(account.subscription.status, "active");
    assert.equal(account.subscription.planId, "byok");
    assert.equal(account.subscription.interval, "monthly");
  });

  it("ignores non-subscription checkout sessions", async () => {
    const client = createInMemorySupabase();
    const result = await handleCheckoutSessionCompleted(
      client,
      sessionFixture({ mode: "payment" }),
    );
    assert.equal(result.activated, false);
    assert.equal(result.reason, "not_subscription_mode");
  });

  it("requires user id and plan metadata", async () => {
    const client = createInMemorySupabase();
    const missingUser = await handleCheckoutSessionCompleted(
      client,
      sessionFixture({ client_reference_id: null, metadata: { planId: "byok", interval: "monthly" } }),
    );
    assert.equal(missingUser.activated, false);
    assert.equal(missingUser.reason, "missing_user_id");

    const missingPlan = await handleCheckoutSessionCompleted(
      client,
      sessionFixture({ metadata: {} }),
    );
    assert.equal(missingPlan.activated, false);
    assert.equal(missingPlan.reason, "missing_plan_metadata");
  });
});
