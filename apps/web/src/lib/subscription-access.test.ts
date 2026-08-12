/**
 * @file apps/web/src/lib/subscription-access.test.ts
 * Access helpers + SubscriptionGate decision → trial-ended modal coverage.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { UserSubscription } from "@tradingagents/api-types";
import { TRIAL_DAYS } from "@tradingagents/api-types";
import {
  canShareReports,
  hasActiveSubscription,
  isTrialExpired,
  resolveSubscriptionGateDecision,
  trialEndedModalVariantForDecision,
} from "./subscription-access";
import {
  getTrialEndedModalCopy,
  TRIAL_ENDED_MODAL_COPY,
} from "./trial-ended-modal-content";
import { buildCheckoutHref, PRICING_PLANS, PRICING_SHARED_FEATURES } from "./pricing-content";

function subscription(partial: Partial<UserSubscription> & Pick<UserSubscription, "status">): UserSubscription {
  return {
    planId: partial.planId ?? null,
    interval: partial.interval ?? null,
    status: partial.status,
    currentPeriodStart: partial.currentPeriodStart ?? null,
    currentPeriodEnd: partial.currentPeriodEnd ?? null,
    cancelAtPeriodEnd: partial.cancelAtPeriodEnd ?? false,
    isTrial: partial.isTrial,
    trialEndsAt: partial.trialEndsAt,
  };
}

/** Day-14 style snapshot: trial started, then marked expired by the API. */
function day14ExpiredTrial(planId: "standard" | "pro" = "pro"): UserSubscription {
  const periodStart = "2026-07-28T00:00:00.000Z";
  const periodEnd = "2026-08-11T00:00:00.000Z"; // 14 days later
  return subscription({
    planId,
    interval: "monthly",
    status: "expired",
    currentPeriodStart: periodStart,
    currentPeriodEnd: periodEnd,
    isTrial: false,
    trialEndsAt: null,
  });
}

describe("hasActiveSubscription", () => {
  it("requires an active or trialing standard or pro plan", () => {
    assert.equal(hasActiveSubscription(null), false);
    assert.equal(
      hasActiveSubscription(
        subscription({
          status: "none",
        }),
      ),
      false,
    );
    assert.equal(
      hasActiveSubscription(
        subscription({
          planId: "pro",
          interval: "monthly",
          status: "trialing",
          currentPeriodStart: "2026-07-01T00:00:00.000Z",
          currentPeriodEnd: "2099-08-01T00:00:00.000Z",
        }),
      ),
      true,
    );
    assert.equal(
      hasActiveSubscription(
        subscription({
          planId: "standard",
          interval: "monthly",
          status: "active",
          currentPeriodStart: "2026-07-01T00:00:00.000Z",
          currentPeriodEnd: "2099-08-01T00:00:00.000Z",
        }),
      ),
      true,
    );
  });

  it("treats an expired period end as inactive even if status lags", () => {
    assert.equal(
      hasActiveSubscription(
        subscription({
          planId: "pro",
          interval: "monthly",
          status: "trialing",
          currentPeriodStart: "2026-07-01T00:00:00.000Z",
          currentPeriodEnd: "2026-07-15T00:00:00.000Z",
        }),
      ),
      false,
    );
  });
});

describe("isTrialExpired", () => {
  it("detects API expired status", () => {
    assert.equal(isTrialExpired(day14ExpiredTrial()), true);
  });

  it("detects a past period end while still marked trialing", () => {
    assert.equal(
      isTrialExpired(
        subscription({
          planId: "pro",
          interval: "monthly",
          status: "trialing",
          isTrial: true,
          currentPeriodStart: "2026-07-01T00:00:00.000Z",
          currentPeriodEnd: "2026-07-15T00:00:00.000Z",
        }),
      ),
      true,
    );
  });

  it("is false while trial is still open", () => {
    assert.equal(
      isTrialExpired(
        subscription({
          planId: "pro",
          interval: "monthly",
          status: "trialing",
          isTrial: true,
          currentPeriodStart: "2026-07-01T00:00:00.000Z",
          currentPeriodEnd: "2099-08-01T00:00:00.000Z",
        }),
      ),
      false,
    );
  });

  it("is false for active paid and empty subscriptions", () => {
    assert.equal(isTrialExpired(null), false);
    assert.equal(
      isTrialExpired(
        subscription({
          planId: "pro",
          interval: "monthly",
          status: "active",
          currentPeriodStart: "2026-07-01T00:00:00.000Z",
          currentPeriodEnd: "2099-08-01T00:00:00.000Z",
        }),
      ),
      false,
    );
  });
});

describe("resolveSubscriptionGateDecision — day-14 trial over → trial-ended modal", () => {
  it("maps an API-expired trial user to trial_expired (shows TrialEndedModal)", () => {
    const decision = resolveSubscriptionGateDecision(day14ExpiredTrial("pro"));
    assert.deepEqual(decision, { kind: "trial_expired" });
    assert.equal(trialEndedModalVariantForDecision(decision), "trial_expired");
  });

  it("maps Standard expired trials the same way", () => {
    const decision = resolveSubscriptionGateDecision(day14ExpiredTrial("standard"));
    assert.deepEqual(decision, { kind: "trial_expired" });
    assert.equal(trialEndedModalVariantForDecision(decision), "trial_expired");
  });

  it("maps a lagging trialing status past period end to trial_expired", () => {
    const lagging = subscription({
      planId: "pro",
      interval: "monthly",
      status: "trialing",
      isTrial: true,
      currentPeriodStart: "2026-07-28T00:00:00.000Z",
      currentPeriodEnd: "2026-08-11T00:00:00.000Z",
    });
    assert.equal(hasActiveSubscription(lagging), false);
    assert.equal(isTrialExpired(lagging), true);

    const decision = resolveSubscriptionGateDecision(lagging);
    assert.deepEqual(decision, { kind: "trial_expired" });
    assert.equal(trialEndedModalVariantForDecision(decision), "trial_expired");
  });

  it("does not try to restart a free trial once the plan exists but expired", () => {
    const decision = resolveSubscriptionGateDecision(day14ExpiredTrial());
    assert.notEqual(decision.kind, "try_start_trial");
    assert.notEqual(decision.kind, "ready");
  });

  it("still allows active and open trialing users into the app", () => {
    assert.deepEqual(
      resolveSubscriptionGateDecision(
        subscription({
          planId: "pro",
          interval: "monthly",
          status: "trialing",
          isTrial: true,
          currentPeriodStart: "2026-07-28T00:00:00.000Z",
          currentPeriodEnd: "2099-08-11T00:00:00.000Z",
        }),
      ),
      { kind: "ready" },
    );
    assert.equal(
      trialEndedModalVariantForDecision({ kind: "ready" }),
      null,
    );
  });

  it("starts a trial only when the user has never had a plan", () => {
    assert.deepEqual(
      resolveSubscriptionGateDecision(subscription({ status: "none" })),
      { kind: "try_start_trial" },
    );
    assert.deepEqual(
      resolveSubscriptionGateDecision(
        subscription({ status: "canceled", planId: null }),
      ),
      { kind: "try_start_trial" },
    );
  });

  it("maps canceled paid access to subscription_required modal (not trial copy)", () => {
    const decision = resolveSubscriptionGateDecision(
      subscription({
        planId: "pro",
        interval: "monthly",
        status: "canceled",
        currentPeriodStart: "2026-07-01T00:00:00.000Z",
        currentPeriodEnd: "2026-08-01T00:00:00.000Z",
      }),
    );
    assert.deepEqual(decision, { kind: "subscription_required" });
    assert.equal(trialEndedModalVariantForDecision(decision), "subscription_required");
  });

  it("models a full day-14 login path: no ready access and trial-ended modal variant", () => {
    // User successfully authenticates (Clerk). Product gate only looks at billing.
    const account = { subscription: day14ExpiredTrial("pro") };
    assert.equal(hasActiveSubscription(account.subscription), false);

    const decision = resolveSubscriptionGateDecision(account.subscription);
    const modalVariant = trialEndedModalVariantForDecision(decision);

    assert.equal(decision.kind, "trial_expired");
    assert.equal(modalVariant, "trial_expired");

    // Modal content expectation: trial-over title + subscribe CTAs.
    const copy = getTrialEndedModalCopy(modalVariant!);
    assert.equal(copy.title, "Your free trial is over");
    assert.equal(copy.eyebrow, "Trial ended");
    assert.match(copy.intro, /Subscribe/i);
    assert.equal(copy.subscribeProLabel, "Subscribe to Pro");
    assert.equal(copy.subscribeStandardLabel, "Subscribe to Standard");
  });
});

describe("trial-ended modal content (trial_expired)", () => {
  it("uses dedicated trial-over copy, not the generic subscription-required title", () => {
    const trial = TRIAL_ENDED_MODAL_COPY.trial_expired;
    const required = TRIAL_ENDED_MODAL_COPY.subscription_required;

    assert.equal(trial.title, "Your free trial is over");
    assert.notEqual(trial.title, required.title);
    assert.equal(trial.eyebrow, "Trial ended");
    assert.match(trial.benefitsHeading, /Why subscribe/i);
    assert.match(trial.continuityBenefit.title, /already ran/i);
  });

  it("exposes both Standard and Pro subscribe labels and checkout destinations", () => {
    const copy = getTrialEndedModalCopy("trial_expired");
    assert.ok(PRICING_PLANS.some((plan) => plan.id === "standard"));
    assert.ok(PRICING_PLANS.some((plan) => plan.id === "pro"));

    assert.equal(
      buildCheckoutHref("pro", "monthly"),
      "/checkout?plan=pro&interval=monthly",
    );
    assert.equal(
      buildCheckoutHref("standard", "monthly"),
      "/checkout?plan=standard&interval=monthly",
    );
    assert.equal(copy.subscribeProLabel, "Subscribe to Pro");
    assert.equal(copy.subscribeStandardLabel, "Subscribe to Standard");
  });

  it("highlights product benefits (and does not re-offer the free trial as a benefit)", () => {
    const benefits = PRICING_SHARED_FEATURES.filter(
      (feature) => feature.title !== "14-day free trial",
    );
    assert.ok(benefits.length >= 2);
    assert.ok(benefits.some((feature) => /Agents Model/i.test(feature.title)));
    assert.ok(benefits.some((feature) => /Multi-agent/i.test(feature.title)));
    assert.equal(
      benefits.some((feature) => /14-day free trial/i.test(feature.title)),
      false,
    );

    const copy = getTrialEndedModalCopy("trial_expired");
    assert.match(copy.continuityBenefit.description, /Past reports/i);
  });

  it("documents TRIAL_DAYS as 14 for the free trial product model", () => {
    assert.equal(TRIAL_DAYS, 14);
  });
});

describe("canShareReports", () => {
  it("requires an active Pro entitlement", () => {
    assert.equal(
      canShareReports(
        subscription({
          planId: "pro",
          interval: "monthly",
          status: "trialing",
          currentPeriodStart: "2026-07-01T00:00:00.000Z",
          currentPeriodEnd: "2099-08-01T00:00:00.000Z",
        }),
      ),
      true,
    );
    assert.equal(canShareReports(day14ExpiredTrial("pro")), false);
    assert.equal(
      canShareReports(
        subscription({
          planId: "standard",
          interval: "monthly",
          status: "active",
          currentPeriodStart: "2026-07-01T00:00:00.000Z",
          currentPeriodEnd: "2099-08-01T00:00:00.000Z",
        }),
      ),
      false,
    );
  });
});
