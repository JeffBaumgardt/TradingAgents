/**
 * @file apps/web/src/lib/subscription-access.ts
 * Shared rules for whether a user may start model runs.
 */

import type { UserSubscription } from "@tradingagents/api-types";

/** True when the user has an active paid plan (BYOK or Hosted) within period. */
export function hasActiveSubscription(subscription: UserSubscription | null | undefined): boolean {
  if (!subscription) {
    return false;
  }
  if (
    subscription.status !== "active" ||
    (subscription.planId !== "byok" && subscription.planId !== "hosted")
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
