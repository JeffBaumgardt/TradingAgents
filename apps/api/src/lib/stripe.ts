/**
 * apps/api/src/lib/stripe.ts
 *
 * Stripe client for Managed Payments Checkout. Leave apiVersion unset on init;
 * Managed Payments requests pass the blueprint preview version per-call.
 */

import Stripe from "stripe";

/** Blueprint-required preview version for Managed Payments product/checkout calls. */
export const STRIPE_MANAGED_PAYMENTS_API_VERSION = "2026-02-25.preview";

let stripeClient: Stripe | null = null;

export function isStripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY?.trim());
}

export function getStripeClient(): Stripe {
  const secretKey = process.env.STRIPE_SECRET_KEY?.trim();
  if (!secretKey) {
    throw new Error(
      "STRIPE_SECRET_KEY is not set. Obtain keys from https://dashboard.stripe.com/apikeys",
    );
  }

  if (!stripeClient) {
    // Intentionally omit apiVersion — use the SDK default unless a request
    // overrides it (Managed Payments Checkout uses the preview header).
    stripeClient = new Stripe(secretKey);
  }

  return stripeClient;
}

/** Reset the cached client (tests). */
export function resetStripeClientForTests(): void {
  stripeClient = null;
}
