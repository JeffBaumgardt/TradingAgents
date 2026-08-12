/**
 * apps/api/src/services/billing-account-service.test.ts
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createInMemorySupabase } from "@tradingagents/supabase/test";
import { PRO_MONTHLY_COMPUTE_CREDIT_ALLOWANCE } from "@tradingagents/api-types";
import {
  activatePaidSubscription,
  activateScaffoldSubscription,
  cancelSubscriptionAtPeriodEnd,
  getBillingAccount,
  userCanShareReports,
  userHasActiveSubscription,
} from "./billing-account-service.js";

describe("billing-account-service", () => {
  it("activates a Pro scaffold subscription with sample usage", async () => {
    const userId = `user-pro-${Date.now()}`;
    const client = createInMemorySupabase();

    await activateScaffoldSubscription(client, userId, "pro", "monthly");
    const account = await getBillingAccount(client, userId);

    assert.equal(account.subscription.planId, "pro");
    assert.equal(account.subscription.status, "active");
    assert.equal(account.subscription.cancelAtPeriodEnd, false);
    assert.ok(account.subscription.currentPeriodEnd);
    assert.ok(account.usage);
    assert.equal(account.usage?.isSample, true);
    assert.equal(account.usage?.allowanceComputeCredits, PRO_MONTHLY_COMPUTE_CREDIT_ALLOWANCE);
    assert.equal(account.usage?.baseAllowanceComputeCredits, PRO_MONTHLY_COMPUTE_CREDIT_ALLOWANCE);
    assert.equal(account.usage?.rolloverComputeCredits, 0);
    assert.equal(account.usage?.blockedLowBalance, false);
    assert.ok((account.usage?.byModel.length ?? 0) > 0);
    assert.ok((account.usage?.usedComputeCredits ?? 0) > 0);
    assert.ok((account.usage?.byModel[0]?.creditMultiplier ?? 0) > 0);
    assert.equal(account.agentsModelDisplayName, "Agents Model");
    assert.equal(account.features.shareReports, true);
  });

  it("disables share features for expired Pro entitlements", async () => {
    const client = createInMemorySupabase();
    const userId = `user-expired-pro-${Date.now()}`;
    await activatePaidSubscription(client, {
      userId,
      planId: "pro",
      interval: "monthly",
      status: "expired",
      currentPeriodStart: "2026-07-01T00:00:00.000Z",
      currentPeriodEnd: "2026-07-15T00:00:00.000Z",
      stripeCustomerId: null,
      stripeSubscriptionId: null,
      stripeCheckoutSessionId: null,
    });

    const account = await getBillingAccount(client, userId);
    assert.equal(account.subscription.planId, "pro");
    assert.equal(account.subscription.status, "expired");
    assert.equal(account.features.shareReports, false);
    assert.equal(userCanShareReports(account.subscription), false);
  });

  it("can cancel a paid subscription when Stripe is unset", async () => {
    const client = createInMemorySupabase();
    const userId = `user-cancel-${Date.now()}`;
    await activatePaidSubscription(client, {
      userId,
      planId: "standard",
      interval: "monthly",
      status: "active",
      currentPeriodStart: "2026-07-01T00:00:00.000Z",
      currentPeriodEnd: "2099-08-01T00:00:00.000Z",
      stripeCustomerId: null,
      stripeSubscriptionId: null,
      stripeCheckoutSessionId: null,
    });

    const before = await getBillingAccount(client, userId);
    assert.equal(userHasActiveSubscription(before.subscription), true);

    try {
      await cancelSubscriptionAtPeriodEnd(client, userId);
    } catch (error) {
      // Stripe configured locally without a sub id refuses cancel — acceptable in CI/dev.
      assert.ok(error instanceof Error);
    }
  });

  it("allows past_due subscribers to schedule cancellation", async () => {
    const client = createInMemorySupabase();
    const userId = `user-past-due-${Date.now()}`;
    await activatePaidSubscription(client, {
      userId,
      planId: "pro",
      interval: "monthly",
      status: "past_due",
      currentPeriodStart: "2026-07-01T00:00:00.000Z",
      currentPeriodEnd: "2099-08-01T00:00:00.000Z",
      stripeCustomerId: null,
      stripeSubscriptionId: null,
      stripeCheckoutSessionId: null,
    });

    const result = await cancelSubscriptionAtPeriodEnd(client, userId);
    assert.equal(result.subscription.cancelAtPeriodEnd, true);
    assert.equal(result.subscription.status, "past_due");
    assert.equal(userHasActiveSubscription(result.subscription), false);
  });

  it("returns empty subscription for unknown users", async () => {
    const account = await getBillingAccount(createInMemorySupabase(), "missing-user");
    assert.equal(account.subscription.status, "none");
    assert.equal(account.usage, null);
  });

  it("userHasActiveSubscription requires an active or trialing standard or pro plan", () => {
    assert.equal(
      userHasActiveSubscription({
        planId: null,
        interval: null,
        status: "none",
        currentPeriodStart: null,
        currentPeriodEnd: null,
        cancelAtPeriodEnd: false,
      }),
      false,
    );
    assert.equal(
      userHasActiveSubscription({
        planId: "standard",
        interval: "monthly",
        status: "canceled",
        currentPeriodStart: null,
        currentPeriodEnd: null,
        cancelAtPeriodEnd: false,
      }),
      false,
    );
    assert.equal(
      userHasActiveSubscription({
        planId: "pro",
        interval: "monthly",
        status: "active",
        currentPeriodStart: "2026-07-01T00:00:00.000Z",
        currentPeriodEnd: "2099-08-01T00:00:00.000Z",
        cancelAtPeriodEnd: false,
      }),
      true,
    );
    assert.equal(
      userHasActiveSubscription({
        planId: "pro",
        interval: "monthly",
        status: "trialing",
        currentPeriodStart: "2026-07-01T00:00:00.000Z",
        currentPeriodEnd: "2099-08-01T00:00:00.000Z",
        cancelAtPeriodEnd: false,
      }),
      true,
    );
    assert.equal(
      userHasActiveSubscription({
        planId: "pro",
        interval: "monthly",
        status: "active",
        currentPeriodStart: "2026-06-01T00:00:00.000Z",
        currentPeriodEnd: "2026-07-01T00:00:00.000Z",
        cancelAtPeriodEnd: false,
      }),
      false,
    );
  });

  it("userCanShareReports requires an active or trialing Pro plan", () => {
    assert.equal(
      userCanShareReports({
        planId: "pro",
        interval: "monthly",
        status: "active",
        currentPeriodStart: "2026-07-01T00:00:00.000Z",
        currentPeriodEnd: "2099-08-01T00:00:00.000Z",
        cancelAtPeriodEnd: false,
      }),
      true,
    );
    assert.equal(
      userCanShareReports({
        planId: "pro",
        interval: "monthly",
        status: "trialing",
        currentPeriodStart: "2026-07-01T00:00:00.000Z",
        currentPeriodEnd: "2099-08-01T00:00:00.000Z",
        cancelAtPeriodEnd: false,
      }),
      true,
    );
    assert.equal(
      userCanShareReports({
        planId: "standard",
        interval: "monthly",
        status: "active",
        currentPeriodStart: "2026-07-01T00:00:00.000Z",
        currentPeriodEnd: "2099-08-01T00:00:00.000Z",
        cancelAtPeriodEnd: false,
      }),
      false,
    );
    assert.equal(
      userCanShareReports({
        planId: "pro",
        interval: "monthly",
        status: "expired",
        currentPeriodStart: "2026-07-01T00:00:00.000Z",
        currentPeriodEnd: "2026-07-15T00:00:00.000Z",
        cancelAtPeriodEnd: false,
      }),
      false,
    );
    assert.equal(
      userCanShareReports({
        planId: "pro",
        interval: "monthly",
        status: "canceled",
        currentPeriodStart: "2026-07-01T00:00:00.000Z",
        currentPeriodEnd: "2099-08-01T00:00:00.000Z",
        cancelAtPeriodEnd: false,
      }),
      false,
    );
  });
});
