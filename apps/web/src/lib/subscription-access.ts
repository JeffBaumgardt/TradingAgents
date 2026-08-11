/**
 * @file apps/web/src/lib/subscription-access.ts
 * Shared rules for whether a user may start model runs.
 */

import type { UserSubscription } from "@tradingagents/api-types";

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

/** True when the user can share reports by public link (Pro only). */
export function canShareReports(subscription: UserSubscription | null | undefined): boolean {
  if (!subscription) {
    return false;
  }
  return subscription.planId === "pro";
}
