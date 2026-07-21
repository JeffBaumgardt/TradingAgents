/**
 * @file apps/web/src/lib/checkout-redirect.ts
 * Helpers for the Clerk → payment checkout path.
 */

import type { BillingInterval, BillingPlanId } from "@/lib/pricing-content";
import { buildCheckoutHref } from "@/lib/pricing-content";

/** Query param Clerk / our auth pages use to return to checkout after account setup. */
export const CHECKOUT_REDIRECT_PARAM = "redirect_url";

export function buildCheckoutPath(planId: BillingPlanId, interval: BillingInterval): string {
  return buildCheckoutHref(planId, interval);
}

/**
 * Sign-up URL that returns the user to checkout (payment step) after Clerk finishes.
 */
export function buildCheckoutSignUpHref(planId: BillingPlanId, interval: BillingInterval): string {
  const checkoutPath = buildCheckoutPath(planId, interval);
  const params = new URLSearchParams({
    [CHECKOUT_REDIRECT_PARAM]: checkoutPath,
  });
  return `/sign-up?${params.toString()}`;
}

/**
 * Sign-in URL that returns the user to checkout after Clerk finishes.
 */
export function buildCheckoutSignInHref(planId: BillingPlanId, interval: BillingInterval): string {
  const checkoutPath = buildCheckoutPath(planId, interval);
  const params = new URLSearchParams({
    [CHECKOUT_REDIRECT_PARAM]: checkoutPath,
  });
  return `/sign-in?${params.toString()}`;
}

/**
 * Only allow same-origin relative redirects (open-redirect safe).
 */
export function sanitizeAppRedirectPath(
  value: string | null | undefined,
  fallback: string,
): string {
  if (!value) {
    return fallback;
  }
  const trimmed = value.trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) {
    return fallback;
  }
  return trimmed;
}
