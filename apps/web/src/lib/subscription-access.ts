/**
 * @file apps/web/src/lib/subscription-access.ts
 * Shared rules for whether a user may start model runs.
 */

import type { UserSubscription } from "@tradingagents/api-types";

/** True when the user has an active paid plan (BYOK or Hosted). */
export function hasActiveSubscription(subscription: UserSubscription | null | undefined): boolean {
  if (!subscription) {
    return false;
  }
  return (
    subscription.status === "active" &&
    (subscription.planId === "byok" || subscription.planId === "hosted")
  );
}
