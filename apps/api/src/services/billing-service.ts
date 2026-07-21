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
import type { AppSupabaseClient } from "@tradingagents/supabase";
import { activateScaffoldSubscription } from "./billing-account-service.js";

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

export interface CheckoutResult extends CheckoutResponse {
  subscriptionActivated: boolean;
}

/**
 * Validates checkout intent and returns a scaffold response.
 * When a userId is present, activates an in-process subscription so profile UI works
 * before Stripe is wired.
 */
export async function createCheckoutSession(
  body: unknown,
  options: { userId?: string | null; client?: AppSupabaseClient | null } = {},
): Promise<CheckoutResult> {
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

  let subscriptionActivated = false;
  if (options.userId && options.client) {
    await activateScaffoldSubscription(
      options.client,
      options.userId,
      payload.planId,
      payload.interval,
    );
    subscriptionActivated = true;
  }

  return {
    status: "not_configured",
    planId: payload.planId,
    interval: payload.interval,
    checkoutUrl: null,
    subscriptionActivated,
    message: subscriptionActivated
      ? "Payment provider is not live yet, but your plan was activated in scaffold mode so you can review the billing page."
      : "Checkout is scaffolded. Sign in and continue to activate a reviewable scaffold subscription, or connect Stripe later.",
  };
}
