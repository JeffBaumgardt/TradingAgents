/**
 * apps/api/src/services/stripe-webhook-service.ts
 *
 * Handles Stripe webhook events for Managed Payments Checkout + subscription lifecycle.
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
import {
  activatePaidSubscription,
  syncStripeSubscription,
} from "./billing-account-service.js";

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

function resolvePlanAndInterval(metadata: Stripe.Metadata | null | undefined): {
  planId: BillingPlanId;
  interval: BillingInterval;
} | null {
  const planId = metadata?.planId;
  const interval = metadata?.interval;
  if (!isBillingPlanId(planId) || !isBillingInterval(interval)) {
    return null;
  }
  return { planId, interval };
}

function mapStripeSubscriptionStatus(
  status: Stripe.Subscription.Status,
): "active" | "past_due" | "canceled" | null {
  switch (status) {
    case "active":
    case "trialing":
      return "active";
    case "past_due":
      return "past_due";
    case "canceled":
    case "unpaid":
    case "incomplete_expired":
    case "paused":
      return "canceled";
    case "incomplete":
      return null;
    default:
      return null;
  }
}

function periodDatesFromSubscription(subscription: Stripe.Subscription): {
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
} {
  const item = subscription.items?.data?.[0];
  return {
    currentPeriodStart: unixToIso(item?.current_period_start),
    currentPeriodEnd: unixToIso(item?.current_period_end),
  };
}

function isCheckoutPaymentComplete(session: Stripe.Checkout.Session): boolean {
  return (
    session.payment_status === "paid" ||
    session.payment_status === "no_payment_required"
  );
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

  if (!isCheckoutPaymentComplete(session)) {
    // Delayed payment methods complete via checkout.session.async_payment_succeeded.
    return { activated: false, reason: "payment_not_complete" };
  }

  const userId =
    session.client_reference_id?.trim() ||
    session.metadata?.userId?.trim() ||
    null;
  if (!userId) {
    return { activated: false, reason: "missing_user_id" };
  }

  const planInterval = resolvePlanAndInterval(session.metadata);
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
      const mapped = mapStripeSubscriptionStatus(subscription.status);
      if (mapped !== "active") {
        return { activated: false, reason: "subscription_not_active" };
      }
      const { currentPeriodStart: start, currentPeriodEnd: end } =
        periodDatesFromSubscription(subscription);
      if (start) {
        currentPeriodStart = start;
      }
      if (end) {
        currentPeriodEnd = end;
      }
    } catch (error) {
      // Fail closed so Stripe retries instead of granting access without a
      // confirmed subscription state.
      throw new Error(
        `Failed to retrieve Stripe subscription ${stripeSubscriptionId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
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

async function handleSubscriptionLifecycle(
  client: AppSupabaseClient,
  subscription: Stripe.Subscription,
  forceStatus?: "canceled",
): Promise<{ handled: boolean; detail?: string }> {
  const stripeSubscriptionId = subscription.id;
  const mapped =
    forceStatus ?? mapStripeSubscriptionStatus(subscription.status);
  if (!mapped) {
    return { handled: false, detail: "subscription_status_ignored" };
  }

  const planInterval = resolvePlanAndInterval(subscription.metadata);
  const { currentPeriodStart, currentPeriodEnd } =
    periodDatesFromSubscription(subscription);

  const result = await syncStripeSubscription(client, {
    stripeSubscriptionId,
    status: mapped,
    planId: planInterval?.planId ?? null,
    interval: planInterval?.interval ?? null,
    currentPeriodStart,
    currentPeriodEnd,
    stripeCustomerId: asStringId(subscription.customer),
  });

  return {
    handled: result.updated,
    detail: result.reason,
  };
}

export async function processStripeEvent(
  client: AppSupabaseClient,
  event: Stripe.Event,
): Promise<{ handled: boolean; detail?: string }> {
  switch (event.type) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded": {
      const session = event.data.object as Stripe.Checkout.Session;
      const result = await handleCheckoutSessionCompleted(client, session);
      return {
        handled: result.activated,
        detail: result.reason,
      };
    }
    case "checkout.session.async_payment_failed": {
      return { handled: false, detail: "async_payment_failed" };
    }
    case "customer.subscription.updated": {
      const subscription = event.data.object as Stripe.Subscription;
      return handleSubscriptionLifecycle(client, subscription);
    }
    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      return handleSubscriptionLifecycle(client, subscription, "canceled");
    }
    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice;
      const subscriptionId = asStringId(
        invoice.parent?.subscription_details?.subscription ?? null,
      );
      if (!subscriptionId) {
        return { handled: false, detail: "invoice_missing_subscription" };
      }
      const result = await syncStripeSubscription(client, {
        stripeSubscriptionId: subscriptionId,
        status: "past_due",
      });
      return { handled: result.updated, detail: result.reason };
    }
    default:
      return { handled: false, detail: "ignored_event_type" };
  }
}
