/**
 * @file apps/web/src/lib/subscription-access.ts
 * Shared rules for whether a user may start model runs.
 */

import type { UserSubscription } from "@tradingagents/api-types";

/** Outcome of SubscriptionGate for a billing subscription snapshot. */
export type SubscriptionGateDecision =
  | { kind: "ready" }
  | { kind: "try_start_trial" }
  | { kind: "trial_expired" }
  | { kind: "subscription_required" };

/** True when the user has an active or trialing Standard/Pro plan within period. */
export function hasActiveSubscription(subscription: UserSubscription | null | undefined): boolean {
  if (!subscription) {
    return false;
  }
  if (
    (subscription.status !== "active" && subscription.status !== "trialing") ||
    (subscription.planId !== "standard" && subscription.planId !== "pro")
  ) {
    return false;
  }
  if (subscription.currentPeriodEnd) {
    const periodEndMs = Date.parse(subscription.currentPeriodEnd);
    if (Number.isFinite(periodEndMs) && periodEndMs < Date.now()) {
      return false;
    }
  }
  return true;
}

/**
 * True when the free trial has ended (API `expired`, or period end passed while
 * still marked trialing). Login still succeeds; product access is blocked.
 */
export function isTrialExpired(subscription: UserSubscription | null | undefined): boolean {
  if (!subscription) {
    return false;
  }
  if (subscription.status === "expired") {
    return true;
  }
  if (subscription.status !== "trialing" && !subscription.isTrial) {
    return false;
  }
  if (!subscription.currentPeriodEnd) {
    return false;
  }
  const periodEndMs = Date.parse(subscription.currentPeriodEnd);
  return Number.isFinite(periodEndMs) && periodEndMs < Date.now();
}

/**
 * Pure gate decision used by SubscriptionGate after load (and after any trial-start attempt).
 * Expired trial → non-closeable paywall modal (trial_expired).
 */
export function resolveSubscriptionGateDecision(
  subscription: UserSubscription | null | undefined,
): SubscriptionGateDecision {
  if (hasActiveSubscription(subscription)) {
    return { kind: "ready" };
  }

  if (
    !subscription ||
    subscription.status === "none" ||
    subscription.planId == null
  ) {
    return { kind: "try_start_trial" };
  }

  if (isTrialExpired(subscription)) {
    return { kind: "trial_expired" };
  }

  return { kind: "subscription_required" };
}

/** Which TrialEndedModal variant to show (null when the gate should not show a modal). */
export function trialEndedModalVariantForDecision(
  decision: SubscriptionGateDecision,
): "trial_expired" | "subscription_required" | null {
  if (decision.kind === "trial_expired") {
    return "trial_expired";
  }
  if (decision.kind === "subscription_required") {
    return "subscription_required";
  }
  return null;
}

/** True when the account may share reports by public link (active Pro only). */
export function canShareReports(subscription: UserSubscription | null | undefined): boolean {
  if (!subscription) {
    return false;
  }
  return subscription.planId === "pro" && hasActiveSubscription(subscription);
}
