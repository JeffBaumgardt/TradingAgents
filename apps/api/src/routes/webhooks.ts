/**
 * apps/api/src/routes/webhooks.ts
 *
 * Clerk webhook handler for user lifecycle sync into SQLite.
 */

import { verifyWebhook } from "@clerk/backend/webhooks";
import { Hono } from "hono";
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

  if (event.type === "user.created" || event.type === "user.updated") {
    const { id, first_name, last_name, image_url } = event.data;
    await upsertUser({
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
      await deleteUser(id);
    }
  }

  return c.json({ ok: true });
});
