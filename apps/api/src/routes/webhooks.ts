/**
 * apps/api/src/routes/webhooks.ts
 *
 * Clerk webhook handler for user lifecycle sync into Supabase.
 */

import { verifyWebhook } from "@clerk/backend/webhooks";
import { Hono } from "hono";
import { getSupabaseAdmin } from "@tradingagents/supabase";
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
