/**
 * apps/api/src/lib/stripe-prices.ts
 *
 * Maps catalog plan + interval to Stripe Price IDs from env.
 */

import type { BillingInterval, BillingPlanId } from "@tradingagents/api-types";

const PRICE_ENV_KEYS = {
  standard: {
    monthly: "STRIPE_PRICE_STANDARD_MONTHLY",
    annual: "STRIPE_PRICE_STANDARD_ANNUAL",
  },
  pro: {
    monthly: "STRIPE_PRICE_PRO_MONTHLY",
    annual: "STRIPE_PRICE_PRO_ANNUAL",
  },
} as const;

export function getStripePriceId(
  planId: BillingPlanId,
  interval: BillingInterval,
): string | null {
  const envKey = PRICE_ENV_KEYS[planId][interval];
  const priceId = process.env[envKey]?.trim();
  return priceId || null;
}

export function areStripePricesConfigured(): boolean {
  return (
    Boolean(getStripePriceId("standard", "monthly")) &&
    Boolean(getStripePriceId("standard", "annual")) &&
    Boolean(getStripePriceId("pro", "monthly")) &&
    Boolean(getStripePriceId("pro", "annual"))
  );
}

export function missingStripePriceEnvKeys(): string[] {
  const missing: string[] = [];
  for (const planId of ["standard", "pro"] as const) {
    for (const interval of ["monthly", "annual"] as const) {
      const envKey = PRICE_ENV_KEYS[planId][interval];
      if (!process.env[envKey]?.trim()) {
        missing.push(envKey);
      }
    }
  }
  return missing;
}
