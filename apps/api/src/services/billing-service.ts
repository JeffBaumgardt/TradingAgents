/**
 * apps/api/src/services/billing-service.ts
 *
 * Billing catalog + Stripe Managed Payments Checkout (scaffold fallback).
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
import type Stripe from "stripe";
import {
  areStripePricesConfigured,
  getStripePriceId,
  missingStripePriceEnvKeys,
} from "../lib/stripe-prices.js";
import {
  getStripeClient,
  isStripeConfigured,
  STRIPE_MANAGED_PAYMENTS_API_VERSION,
} from "../lib/stripe.js";
import { getWebAppOrigin } from "../lib/web-app-origin.js";
import {
  activateScaffoldSubscription,
  findStripeCustomerIdForUser,
} from "./billing-account-service.js";

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

function parseCheckoutBody(body: unknown): {
  planId: BillingPlanId;
  interval: BillingInterval;
} {
  if (!body || typeof body !== "object") {
    throw new BillingServiceError("Invalid checkout payload", 400);
  }

  const payload = body as Record<string, unknown>;
  const planIdRaw = typeof payload.planId === "string" ? payload.planId : null;
  const intervalRaw = typeof payload.interval === "string" ? payload.interval : null;

  if (!isBillingPlanId(planIdRaw)) {
    throw new BillingServiceError("planId must be 'byok' or 'hosted'", 400);
  }
  if (!isBillingInterval(intervalRaw)) {
    throw new BillingServiceError("interval must be 'monthly' or 'annual'", 400);
  }

  if ("successUrl" in payload || "cancelUrl" in payload) {
    throw new BillingServiceError(
      "successUrl and cancelUrl are not accepted; redirects are server-owned",
      400,
    );
  }

  return { planId: planIdRaw, interval: intervalRaw };
}

/**
 * Creates a Stripe Checkout Session with Managed Payments, or returns the
 * scaffold response when Stripe env is not configured.
 */
export async function createCheckoutSession(
  body: unknown,
  options: { userId?: string | null; client?: AppSupabaseClient | null } = {},
): Promise<CheckoutResult> {
  const { planId, interval } = parseCheckoutBody(body);

  if (isStripeConfigured() && areStripePricesConfigured()) {
    return createManagedPaymentsCheckoutSession(planId, interval, options);
  }

  return createScaffoldCheckoutSession(planId, interval, options);
}

async function createScaffoldCheckoutSession(
  planId: BillingPlanId,
  interval: BillingInterval,
  options: { userId?: string | null; client?: AppSupabaseClient | null },
): Promise<CheckoutResult> {
  let subscriptionActivated = false;
  if (options.userId && options.client) {
    await activateScaffoldSubscription(
      options.client,
      options.userId,
      planId,
      interval,
    );
    subscriptionActivated = true;
  }

  const missingPrices = missingStripePriceEnvKeys();
  const stripeHint = !isStripeConfigured()
    ? "Set STRIPE_SECRET_KEY (from https://dashboard.stripe.com/apikeys)."
    : missingPrices.length > 0
      ? `Set Stripe price env vars: ${missingPrices.join(", ")}.`
      : "Connect Stripe to enable Managed Payments Checkout.";

  return {
    status: "not_configured",
    planId,
    interval,
    checkoutUrl: null,
    subscriptionActivated,
    message: subscriptionActivated
      ? `Payment provider is not live yet, but your plan was activated in scaffold mode so you can review the billing page. ${stripeHint}`
      : `Checkout is scaffolded. Sign in and continue to activate a reviewable scaffold subscription, or connect Stripe. ${stripeHint}`,
  };
}

async function createManagedPaymentsCheckoutSession(
  planId: BillingPlanId,
  interval: BillingInterval,
  options: { userId?: string | null; client?: AppSupabaseClient | null },
): Promise<CheckoutResult> {
  if (!options.userId) {
    throw new BillingServiceError(
      "Sign in is required to start Stripe checkout",
      401,
    );
  }

  const priceId = getStripePriceId(planId, interval);
  if (!priceId) {
    throw new BillingServiceError(
      `Stripe price is not configured for ${planId}/${interval}`,
      500,
    );
  }

  const origin = getWebAppOrigin();
  const successUrl = `${origin}/checkout/success?session_id={CHECKOUT_SESSION_ID}`;
  const cancelUrl = `${origin}/checkout?plan=${encodeURIComponent(planId)}&interval=${encodeURIComponent(interval)}`;

  const stripe = getStripeClient();
  const existingCustomerId =
    options.client != null
      ? await findStripeCustomerIdForUser(options.client, options.userId)
      : null;

  const metadata = {
    planId,
    interval,
    userId: options.userId,
  };

  // managed_payments is required for Managed Payments; SDK types may lag the preview API.
  const sessionParams = {
    mode: "subscription" as const,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: successUrl,
    cancel_url: cancelUrl,
    client_reference_id: options.userId,
    metadata,
    subscription_data: { metadata },
    managed_payments: { enabled: true },
    ...(existingCustomerId ? { customer: existingCustomerId } : {}),
  };

  const session = await stripe.checkout.sessions.create(
    // Managed Payments preview fields are not fully typed in stripe-node yet.
    sessionParams as Stripe.Checkout.SessionCreateParams,
    {
      apiVersion: STRIPE_MANAGED_PAYMENTS_API_VERSION,
    } as Stripe.RequestOptions,
  );

  if (!session.url) {
    throw new BillingServiceError("Stripe did not return a checkout URL", 502);
  }

  return {
    status: "ready",
    planId,
    interval,
    checkoutUrl: session.url,
    subscriptionActivated: false,
    message: "Redirecting to Stripe Checkout.",
  };
}
