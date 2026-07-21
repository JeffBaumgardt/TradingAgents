/**
 * apps/api/src/lib/stripe-prices.ts
 *
 * Maps catalog plan + interval to Stripe Price IDs from env.
 */

import type { BillingInterval, BillingPlanId } from "@tradingagents/api-types";

const PRICE_ENV_KEYS = {
  byok: {
    monthly: "STRIPE_PRICE_BYOK_MONTHLY",
    annual: "STRIPE_PRICE_BYOK_ANNUAL",
  },
  hosted: {
    monthly: "STRIPE_PRICE_HOSTED_MONTHLY",
    annual: "STRIPE_PRICE_HOSTED_ANNUAL",
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
    Boolean(getStripePriceId("byok", "monthly")) &&
    Boolean(getStripePriceId("byok", "annual")) &&
    Boolean(getStripePriceId("hosted", "monthly")) &&
    Boolean(getStripePriceId("hosted", "annual"))
  );
}

export function missingStripePriceEnvKeys(): string[] {
  const missing: string[] = [];
  for (const planId of ["byok", "hosted"] as const) {
    for (const interval of ["monthly", "annual"] as const) {
      const envKey = PRICE_ENV_KEYS[planId][interval];
      if (!process.env[envKey]?.trim()) {
        missing.push(envKey);
      }
    }
  }
  return missing;
}
