/**
 * apps/api/src/services/billing-service.ts
 *
 * Billing catalog + checkout scaffold. Payment provider (e.g. Stripe) comes later.
 */

export type BillingPlanId = "byok" | "hosted";
export type BillingInterval = "monthly" | "annual";

export interface BillingPlan {
  id: BillingPlanId;
  name: string;
  monthlyPriceCents: number;
  priceProvisional: boolean;
  annualDiscountPercent: number;
}

export interface CheckoutRequest {
  planId: BillingPlanId;
  interval: BillingInterval;
  successUrl?: string;
  cancelUrl?: string;
}

export interface CheckoutResponse {
  status: "not_configured";
  planId: BillingPlanId;
  interval: BillingInterval;
  checkoutUrl: null;
  message: string;
}

export class BillingServiceError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "BillingServiceError";
    this.status = status;
  }
}

export const ANNUAL_DISCOUNT_PERCENT = 20;

export const BILLING_PLANS: BillingPlan[] = [
  {
    id: "byok",
    name: "Bring your own key",
    monthlyPriceCents: 300,
    priceProvisional: false,
    annualDiscountPercent: ANNUAL_DISCOUNT_PERCENT,
  },
  {
    id: "hosted",
    name: "Hosted models",
    monthlyPriceCents: 2900,
    priceProvisional: true,
    annualDiscountPercent: ANNUAL_DISCOUNT_PERCENT,
  },
];

export function listBillingPlans(): { plans: BillingPlan[] } {
  return { plans: BILLING_PLANS };
}

function isBillingPlanId(value: unknown): value is BillingPlanId {
  return value === "byok" || value === "hosted";
}

function isBillingInterval(value: unknown): value is BillingInterval {
  return value === "monthly" || value === "annual";
}

/**
 * Validates checkout intent and returns a scaffold response.
 * Replace the body with a real Stripe Checkout Session create call later.
 */
export function createCheckoutSession(body: unknown): CheckoutResponse {
  if (!body || typeof body !== "object") {
    throw new BillingServiceError("Invalid checkout payload", 400);
  }

  const payload = body as Record<string, unknown>;
  if (!isBillingPlanId(payload.planId)) {
    throw new BillingServiceError("planId must be 'byok' or 'hosted'", 400);
  }
  if (!isBillingInterval(payload.interval)) {
    throw new BillingServiceError("interval must be 'monthly' or 'annual'", 400);
  }

  if (payload.successUrl !== undefined && typeof payload.successUrl !== "string") {
    throw new BillingServiceError("successUrl must be a string when provided", 400);
  }
  if (payload.cancelUrl !== undefined && typeof payload.cancelUrl !== "string") {
    throw new BillingServiceError("cancelUrl must be a string when provided", 400);
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
