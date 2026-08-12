/**
 * Shared billing fixtures for SubscriptionGate / TrialEndedModal tests.
 */

import type { BillingAccountResponse, UserSubscription } from "@tradingagents/api-types";
import { planFeaturesFor } from "@tradingagents/api-types";

export function subscription(
  partial: Partial<UserSubscription> & Pick<UserSubscription, "status">,
): UserSubscription {
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

export function expiredTrial(planId: "standard" | "pro" = "pro"): UserSubscription {
  return subscription({
    planId,
    interval: "monthly",
    status: "expired",
    currentPeriodStart: "2026-07-28T00:00:00.000Z",
    currentPeriodEnd: "2026-08-11T00:00:00.000Z",
    isTrial: false,
  });
}

export function activePro(): UserSubscription {
  return subscription({
    planId: "pro",
    interval: "monthly",
    status: "active",
    currentPeriodStart: "2026-07-01T00:00:00.000Z",
    currentPeriodEnd: "2099-08-01T00:00:00.000Z",
  });
}

export function openTrial(): UserSubscription {
  return subscription({
    planId: "pro",
    interval: "monthly",
    status: "trialing",
    isTrial: true,
    currentPeriodStart: "2026-07-28T00:00:00.000Z",
    currentPeriodEnd: "2099-08-11T00:00:00.000Z",
  });
}

export function nonePlan(): UserSubscription {
  return subscription({ status: "none", planId: null });
}

export function billingAccount(sub: UserSubscription): BillingAccountResponse {
  return {
    subscription: sub,
    usage: null,
    hostedProviderIds: ["anthropic"],
    features: planFeaturesFor(sub.planId),
    agentsModelDisplayName: "Agents Model",
  };
}
