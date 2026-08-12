/**
 * @file apps/web/src/lib/subscription-access.test.ts
 * Access helpers + SubscriptionGate decision → trial-ended modal coverage.
 */

import { describe, it, expect } from "vitest";
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
    expect(hasActiveSubscription(null)).toBe(false);
    expect(hasActiveSubscription(
        subscription({
          status: "none",
        }),
      )).toBe(false);
    expect(hasActiveSubscription(
        subscription({
          planId: "pro",
          interval: "monthly",
          status: "trialing",
          currentPeriodStart: "2026-07-01T00:00:00.000Z",
          currentPeriodEnd: "2099-08-01T00:00:00.000Z",
        }),
      )).toBe(true);
    expect(hasActiveSubscription(
        subscription({
          planId: "standard",
          interval: "monthly",
          status: "active",
          currentPeriodStart: "2026-07-01T00:00:00.000Z",
          currentPeriodEnd: "2099-08-01T00:00:00.000Z",
        }),
      )).toBe(true);
  });

  it("treats an expired period end as inactive even if status lags", () => {
    expect(hasActiveSubscription(
        subscription({
          planId: "pro",
          interval: "monthly",
          status: "trialing",
          currentPeriodStart: "2026-07-01T00:00:00.000Z",
          currentPeriodEnd: "2026-07-15T00:00:00.000Z",
        }),
      )).toBe(false);
  });
});

describe("isTrialExpired", () => {
  it("detects API expired status", () => {
    expect(isTrialExpired(day14ExpiredTrial())).toBe(true);
  });

  it("detects a past period end while still marked trialing", () => {
    expect(isTrialExpired(
        subscription({
          planId: "pro",
          interval: "monthly",
          status: "trialing",
          isTrial: true,
          currentPeriodStart: "2026-07-01T00:00:00.000Z",
          currentPeriodEnd: "2026-07-15T00:00:00.000Z",
        }),
      )).toBe(true);
  });

  it("is false while trial is still open", () => {
    expect(isTrialExpired(
        subscription({
          planId: "pro",
          interval: "monthly",
          status: "trialing",
          isTrial: true,
          currentPeriodStart: "2026-07-01T00:00:00.000Z",
          currentPeriodEnd: "2099-08-01T00:00:00.000Z",
        }),
      )).toBe(false);
  });

  it("is false for active paid and empty subscriptions", () => {
    expect(isTrialExpired(null)).toBe(false);
    expect(isTrialExpired(
        subscription({
          planId: "pro",
          interval: "monthly",
          status: "active",
          currentPeriodStart: "2026-07-01T00:00:00.000Z",
          currentPeriodEnd: "2099-08-01T00:00:00.000Z",
        }),
      )).toBe(false);
  });
});

describe("resolveSubscriptionGateDecision — day-14 trial over → trial-ended modal", () => {
  it("maps an API-expired trial user to trial_expired (shows TrialEndedModal)", () => {
    const decision = resolveSubscriptionGateDecision(day14ExpiredTrial("pro"));
    expect(decision).toEqual({ kind: "trial_expired" });
    expect(trialEndedModalVariantForDecision(decision)).toBe("trial_expired");
  });

  it("maps Standard expired trials the same way", () => {
    const decision = resolveSubscriptionGateDecision(day14ExpiredTrial("standard"));
    expect(decision).toEqual({ kind: "trial_expired" });
    expect(trialEndedModalVariantForDecision(decision)).toBe("trial_expired");
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
    expect(hasActiveSubscription(lagging)).toBe(false);
    expect(isTrialExpired(lagging)).toBe(true);

    const decision = resolveSubscriptionGateDecision(lagging);
    expect(decision).toEqual({ kind: "trial_expired" });
    expect(trialEndedModalVariantForDecision(decision)).toBe("trial_expired");
  });

  it("does not try to restart a free trial once the plan exists but expired", () => {
    const decision = resolveSubscriptionGateDecision(day14ExpiredTrial());
    expect(decision.kind).not.toBe("try_start_trial");
    expect(decision.kind).not.toBe("ready");
  });

  it("still allows active and open trialing users into the app", () => {
    expect(resolveSubscriptionGateDecision(
        subscription({
          planId: "pro",
          interval: "monthly",
          status: "trialing",
          isTrial: true,
          currentPeriodStart: "2026-07-28T00:00:00.000Z",
          currentPeriodEnd: "2099-08-11T00:00:00.000Z",
        }),
      )).toEqual({ kind: "ready" });
    expect(trialEndedModalVariantForDecision({ kind: "ready" })).toBe(null);
  });

  it("starts a trial only when the user has never had a plan", () => {
    expect(resolveSubscriptionGateDecision(subscription({ status: "none" }))).toEqual({ kind: "try_start_trial" });
    expect(resolveSubscriptionGateDecision(
        subscription({ status: "canceled", planId: null }),
      )).toEqual({ kind: "try_start_trial" });
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
    expect(decision).toEqual({ kind: "subscription_required" });
    expect(trialEndedModalVariantForDecision(decision)).toBe("subscription_required");
  });

  it("models a full day-14 login path: no ready access and trial-ended modal variant", () => {
    // User successfully authenticates (Clerk). Product gate only looks at billing.
    const account = { subscription: day14ExpiredTrial("pro") };
    expect(hasActiveSubscription(account.subscription)).toBe(false);

    const decision = resolveSubscriptionGateDecision(account.subscription);
    const modalVariant = trialEndedModalVariantForDecision(decision);

    expect(decision.kind).toBe("trial_expired");
    expect(modalVariant).toBe("trial_expired");

    // Modal content expectation: trial-over title + subscribe CTAs.
    const copy = getTrialEndedModalCopy(modalVariant!);
    expect(copy.title).toBe("Your free trial is over");
    expect(copy.eyebrow).toBe("Trial ended");
    expect(copy.intro).toMatch(/Subscribe/i);
    expect(copy.subscribeProLabel).toBe("Subscribe to Pro");
    expect(copy.subscribeStandardLabel).toBe("Subscribe to Standard");
  });
});

describe("trial-ended modal content (trial_expired)", () => {
  it("uses dedicated trial-over copy, not the generic subscription-required title", () => {
    const trial = TRIAL_ENDED_MODAL_COPY.trial_expired;
    const required = TRIAL_ENDED_MODAL_COPY.subscription_required;

    expect(trial.title).toBe("Your free trial is over");
    expect(trial.title).not.toBe(required.title);
    expect(trial.eyebrow).toBe("Trial ended");
    expect(trial.benefitsHeading).toMatch(/Why subscribe/i);
    expect(trial.continuityBenefit.title).toMatch(/already ran/i);
  });

  it("exposes both Standard and Pro subscribe labels and checkout destinations", () => {
    const copy = getTrialEndedModalCopy("trial_expired");
    expect(PRICING_PLANS.some((plan) => plan.id === "standard")).toBeTruthy();
    expect(PRICING_PLANS.some((plan) => plan.id === "pro")).toBeTruthy();

    expect(buildCheckoutHref("pro", "monthly")).toBe("/checkout?plan=pro&interval=monthly");
    expect(buildCheckoutHref("standard", "monthly")).toBe("/checkout?plan=standard&interval=monthly");
    expect(copy.subscribeProLabel).toBe("Subscribe to Pro");
    expect(copy.subscribeStandardLabel).toBe("Subscribe to Standard");
  });

  it("highlights product benefits (and does not re-offer the free trial as a benefit)", () => {
    const benefits = PRICING_SHARED_FEATURES.filter(
      (feature) => feature.title !== "14-day free trial",
    );
    expect(benefits.length >= 2).toBeTruthy();
    expect(benefits.some((feature) => /Agents Model/i.test(feature.title))).toBeTruthy();
    expect(benefits.some((feature) => /Multi-agent/i.test(feature.title))).toBeTruthy();
    expect(benefits.some((feature) => /14-day free trial/i.test(feature.title))).toBe(false);

    const copy = getTrialEndedModalCopy("trial_expired");
    expect(copy.continuityBenefit.description).toMatch(/Past reports/i);
  });

  it("documents TRIAL_DAYS as 14 for the free trial product model", () => {
    expect(TRIAL_DAYS).toBe(14);
  });
});

describe("canShareReports", () => {
  it("requires an active Pro entitlement", () => {
    expect(canShareReports(
        subscription({
          planId: "pro",
          interval: "monthly",
          status: "trialing",
          currentPeriodStart: "2026-07-01T00:00:00.000Z",
          currentPeriodEnd: "2099-08-01T00:00:00.000Z",
        }),
      )).toBe(true);
    expect(canShareReports(day14ExpiredTrial("pro"))).toBe(false);
    expect(canShareReports(
        subscription({
          planId: "standard",
          interval: "monthly",
          status: "active",
          currentPeriodStart: "2026-07-01T00:00:00.000Z",
          currentPeriodEnd: "2099-08-01T00:00:00.000Z",
        }),
      )).toBe(false);
  });
});
