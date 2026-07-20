/**
 * apps/api/src/services/billing-service.ts
 *
 * Billing catalog + checkout scaffold. Payment provider (e.g. Stripe) comes later.
 */

import {
  BILLING_CATALOG,
  type BillingInterval,
  type BillingPlan,
  type BillingPlanId,
  type CheckoutResponse,
  isBillingInterval,
  isBillingPlanId,
} from "@tradingagents/api-types";

export type { BillingInterval, BillingPlan, BillingPlanId };

export class BillingServiceError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "BillingServiceError";
    this.status = status;
  }
}

export function listBillingPlans(): { plans: BillingPlan[] } {
  return { plans: [...BILLING_CATALOG] };
}

/**
 * Validates checkout intent and returns a scaffold response.
 * Replace the body with a real Stripe Checkout Session create call later.
 * successUrl/cancelUrl are intentionally omitted until an origin allowlist exists.
 */
export function createCheckoutSession(body: unknown): CheckoutResponse {
  if (!body || typeof body !== "object") {
    throw new BillingServiceError("Invalid checkout payload", 400);
  }

  const payload = body as Record<string, unknown>;
  if (!isBillingPlanId(typeof payload.planId === "string" ? payload.planId : null)) {
    throw new BillingServiceError("planId must be 'byok' or 'hosted'", 400);
  }
  if (
    !isBillingInterval(typeof payload.interval === "string" ? payload.interval : null)
  ) {
    throw new BillingServiceError("interval must be 'monthly' or 'annual'", 400);
  }

  if ("successUrl" in payload || "cancelUrl" in payload) {
    throw new BillingServiceError(
      "successUrl and cancelUrl are not accepted until checkout redirect allowlisting is implemented",
      400,
    );
  }

  return {
    status: "not_configured",
    planId: payload.planId,
    interval: payload.interval,
    checkoutUrl: null,
    message:
      "Checkout is scaffolded. Connect a payment provider (e.g. Stripe) to create a live session.",
  };
}
