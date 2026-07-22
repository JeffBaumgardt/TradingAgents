/**
 * apps/api/src/services/stripe-webhook-service.test.ts
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createInMemorySupabase } from "@tradingagents/supabase/test";
import type Stripe from "stripe";
import {
  handleCheckoutSessionCompleted,
  processStripeEvent,
} from "./stripe-webhook-service.js";
import {
  activatePaidSubscription,
  getBillingAccount,
  userHasActiveSubscription,
} from "./billing-account-service.js";

function sessionFixture(
  overrides: Partial<Stripe.Checkout.Session> = {},
): Stripe.Checkout.Session {
  return {
    id: "cs_test_123",
    object: "checkout.session",
    mode: "subscription",
    payment_status: "paid",
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

  it("does not activate when payment_status is unpaid", async () => {
    const client = createInMemorySupabase();
    const result = await handleCheckoutSessionCompleted(
      client,
      sessionFixture({ payment_status: "unpaid" }),
    );
    assert.equal(result.activated, false);
    assert.equal(result.reason, "payment_not_complete");
  });

  it("requires user id and plan metadata", async () => {
    const client = createInMemorySupabase();
    const missingUser = await handleCheckoutSessionCompleted(
      client,
      sessionFixture({
        client_reference_id: null,
        metadata: { planId: "byok", interval: "monthly" },
      }),
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

  it("marks a subscription canceled on customer.subscription.deleted", async () => {
    const client = createInMemorySupabase();
    await activatePaidSubscription(client, {
      userId: "user_abc",
      planId: "byok",
      interval: "monthly",
      status: "active",
      currentPeriodStart: "2026-07-01T00:00:00.000Z",
      currentPeriodEnd: "2026-08-01T00:00:00.000Z",
      stripeCustomerId: "cus_abc",
      stripeSubscriptionId: "sub_abc",
      stripeCheckoutSessionId: "cs_test_123",
    });

    const result = await processStripeEvent(client, {
      id: "evt_deleted",
      type: "customer.subscription.deleted",
      data: {
        object: {
          id: "sub_abc",
          object: "subscription",
          status: "canceled",
          customer: "cus_abc",
          cancel_at_period_end: false,
          metadata: { planId: "byok", interval: "monthly" },
          items: { data: [] },
        },
      },
    } as unknown as Stripe.Event);

    assert.equal(result.handled, true);
    const account = await getBillingAccount(client, "user_abc");
    assert.equal(account.subscription.status, "canceled");
    assert.equal(account.subscription.cancelAtPeriodEnd, false);
    assert.equal(userHasActiveSubscription(account.subscription), false);
  });

  it("syncs cancel_at_period_end from customer.subscription.updated", async () => {
    const client = createInMemorySupabase();
    await activatePaidSubscription(client, {
      userId: "user_abc",
      planId: "byok",
      interval: "monthly",
      status: "active",
      currentPeriodStart: "2026-07-01T00:00:00.000Z",
      currentPeriodEnd: "2026-08-01T00:00:00.000Z",
      stripeCustomerId: "cus_abc",
      stripeSubscriptionId: "sub_sched",
      stripeCheckoutSessionId: "cs_test_789",
    });

    const result = await processStripeEvent(client, {
      id: "evt_updated",
      type: "customer.subscription.updated",
      data: {
        object: {
          id: "sub_sched",
          object: "subscription",
          status: "active",
          customer: "cus_abc",
          cancel_at_period_end: true,
          metadata: { planId: "byok", interval: "monthly" },
          items: {
            data: [
              {
                current_period_start: Math.floor(
                  Date.parse("2099-07-01T00:00:00.000Z") / 1000,
                ),
                current_period_end: Math.floor(
                  Date.parse("2099-08-01T00:00:00.000Z") / 1000,
                ),
              },
            ],
          },
        },
      },
    } as unknown as Stripe.Event);

    assert.equal(result.handled, true);
    const account = await getBillingAccount(client, "user_abc");
    assert.equal(account.subscription.status, "active");
    assert.equal(account.subscription.cancelAtPeriodEnd, true);
    assert.equal(userHasActiveSubscription(account.subscription), true);
  });

  it("marks a subscription past_due on invoice.payment_failed", async () => {
    const client = createInMemorySupabase();
    await activatePaidSubscription(client, {
      userId: "user_abc",
      planId: "hosted",
      interval: "monthly",
      status: "active",
      currentPeriodStart: "2026-07-01T00:00:00.000Z",
      currentPeriodEnd: "2026-08-01T00:00:00.000Z",
      stripeCustomerId: "cus_abc",
      stripeSubscriptionId: "sub_past",
      stripeCheckoutSessionId: "cs_test_456",
    });

    const result = await processStripeEvent(client, {
      id: "evt_failed",
      type: "invoice.payment_failed",
      data: {
        object: {
          id: "in_123",
          object: "invoice",
          parent: {
            type: "subscription_details",
            subscription_details: {
              subscription: "sub_past",
              metadata: null,
            },
            quote_details: null,
          },
        },
      },
    } as unknown as Stripe.Event);

    assert.equal(result.handled, true);
    const account = await getBillingAccount(client, "user_abc");
    assert.equal(account.subscription.status, "past_due");
    assert.equal(userHasActiveSubscription(account.subscription), false);
  });
});
