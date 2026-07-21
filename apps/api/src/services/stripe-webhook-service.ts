/**
 * apps/api/src/services/stripe-webhook-service.ts
 *
 * Handles Stripe webhook events for Managed Payments Checkout.
 */

import {
  isBillingInterval,
  isBillingPlanId,
  type BillingInterval,
  type BillingPlanId,
} from "@tradingagents/api-types";
import type { AppSupabaseClient } from "@tradingagents/supabase";
import type Stripe from "stripe";
import { getStripeClient } from "../lib/stripe.js";
import { activatePaidSubscription } from "./billing-account-service.js";

function asStringId(
  value: string | { id: string } | null | undefined,
): string | null {
  if (!value) {
    return null;
  }
  return typeof value === "string" ? value : value.id;
}

function unixToIso(seconds: number | null | undefined): string | null {
  if (seconds == null || !Number.isFinite(seconds)) {
    return null;
  }
  return new Date(seconds * 1000).toISOString();
}

function resolvePlanAndInterval(session: Stripe.Checkout.Session): {
  planId: BillingPlanId;
  interval: BillingInterval;
} | null {
  const planId = session.metadata?.planId;
  const interval = session.metadata?.interval;
  if (!isBillingPlanId(planId) || !isBillingInterval(interval)) {
    return null;
  }
  return { planId, interval };
}

/**
 * Activate a subscription after a successful Managed Payments Checkout.
 */
export async function handleCheckoutSessionCompleted(
  client: AppSupabaseClient,
  session: Stripe.Checkout.Session,
): Promise<{ activated: boolean; reason?: string }> {
  if (session.mode !== "subscription") {
    return { activated: false, reason: "not_subscription_mode" };
  }

  const userId =
    session.client_reference_id?.trim() ||
    session.metadata?.userId?.trim() ||
    null;
  if (!userId) {
    return { activated: false, reason: "missing_user_id" };
  }

  const planInterval = resolvePlanAndInterval(session);
  if (!planInterval) {
    return { activated: false, reason: "missing_plan_metadata" };
  }

  const stripeSubscriptionId = asStringId(session.subscription);
  const stripeCustomerId = asStringId(session.customer);
  let currentPeriodStart = new Date().toISOString();
  let currentPeriodEnd =
    planInterval.interval === "annual"
      ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
      : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

  if (stripeSubscriptionId) {
    try {
      const stripe = getStripeClient();
      const subscription = await stripe.subscriptions.retrieve(stripeSubscriptionId);
      // Period dates live on subscription items in current Stripe API versions.
      const item = subscription.items?.data?.[0];
      const start = unixToIso(item?.current_period_start);
      const end = unixToIso(item?.current_period_end);
      if (start) {
        currentPeriodStart = start;
      }
      if (end) {
        currentPeriodEnd = end;
      }
    } catch (error) {
      console.warn(
        "[stripe-webhook] failed to retrieve subscription for period dates:",
        error instanceof Error ? error.message : error,
      );
    }
  }

  await activatePaidSubscription(client, {
    userId,
    planId: planInterval.planId,
    interval: planInterval.interval,
    status: "active",
    currentPeriodStart,
    currentPeriodEnd,
    stripeCustomerId,
    stripeSubscriptionId,
    stripeCheckoutSessionId: session.id,
  });

  return { activated: true };
}

export async function processStripeEvent(
  client: AppSupabaseClient,
  event: Stripe.Event,
): Promise<{ handled: boolean; detail?: string }> {
  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const result = await handleCheckoutSessionCompleted(client, session);
    return {
      handled: result.activated,
      detail: result.reason,
    };
  }

  return { handled: false, detail: "ignored_event_type" };
}
