/**
 * apps/api/src/routes/webhooks.ts
 *
 * Clerk user lifecycle + Stripe Managed Payments Checkout webhooks.
 */

import { verifyWebhook } from "@clerk/backend/webhooks";
import { Hono } from "hono";
import { getSupabaseAdmin } from "@tradingagents/supabase";
import { getStripeClient } from "../lib/stripe.js";
import { processStripeEvent } from "../services/stripe-webhook-service.js";
import {
  deleteUser,
  primaryEmailFromClerkUser,
  upsertUser,
} from "../services/user-service.js";

export const webhookRoutes = new Hono();

webhookRoutes.post("/webhooks/clerk", async (c) => {
  let event;
  try {
    event = await verifyWebhook(c.req.raw, {
      signingSecret: process.env.CLERK_WEBHOOK_SIGNING_SECRET,
    });
  } catch (error) {
    console.error("Clerk webhook verification failed:", error);
    return c.json({ error: "Webhook verification failed" }, 400);
  }

  const client = getSupabaseAdmin(c);

  if (event.type === "user.created" || event.type === "user.updated") {
    const { id, first_name, last_name, image_url } = event.data;
    await upsertUser(client, {
      id,
      email: primaryEmailFromClerkUser(event.data),
      firstName: first_name,
      lastName: last_name,
      imageUrl: image_url,
    });
  }

  if (event.type === "user.deleted") {
    const id = event.data.id;
    if (id) {
      await deleteUser(client, id);
    }
  }

  return c.json({ ok: true });
});

webhookRoutes.post("/webhooks/stripe", async (c) => {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  if (!webhookSecret) {
    console.error("STRIPE_WEBHOOK_SECRET is not set");
    return c.json({ error: "Stripe webhooks are not configured" }, 503);
  }

  const signature = c.req.header("stripe-signature");
  if (!signature) {
    return c.json({ error: "Missing stripe-signature header" }, 400);
  }

  const payload = await c.req.text();
  let event;
  try {
    event = getStripeClient().webhooks.constructEvent(
      payload,
      signature,
      webhookSecret,
    );
  } catch (error) {
    console.error("Stripe webhook verification failed:", error);
    return c.json({ error: "Webhook verification failed" }, 400);
  }

  const client = getSupabaseAdmin(c);
  try {
    const result = await processStripeEvent(client, event);
    // Retry when Checkout completed but entitlement was not written for a
    // potentially transient reason (e.g. subscription not active yet).
    // Permanent skips (wrong mode, unpaid yet, missing metadata) stay 200.
    const retryableCheckoutSkip =
      (event.type === "checkout.session.completed" ||
        event.type === "checkout.session.async_payment_succeeded") &&
      !result.handled &&
      result.detail === "subscription_not_active";

    if (retryableCheckoutSkip) {
      return c.json(
        { error: "Checkout activation deferred", ...result },
        500,
      );
    }

    return c.json({ ok: true, ...result });
  } catch (error) {
    console.error("Stripe webhook handler failed:", error);
    return c.json({ error: "Webhook handler failed" }, 500);
  }
});
