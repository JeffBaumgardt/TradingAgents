/**
 * apps/api/src/routes/feedback.ts
 *
 * Authenticated feedback submission — emails via Resend (no DB persistence).
 */

import { Hono } from "hono";
import { getSupabaseAdmin } from "@tradingagents/supabase";
import { getRequestUserId, requireUserId } from "../middleware/user-context.js";
import {
  FeedbackServiceError,
  sendFeedbackEmail,
} from "../services/feedback-service.js";

export const feedbackRoutes = new Hono();

// Scope auth to /feedback only — use("*") on an app mounted at "/" would
// intercept later public routes (e.g. share-by-link GET /sessions/:id).
feedbackRoutes.use("/feedback", requireUserId());
feedbackRoutes.use("/feedback/*", requireUserId());

feedbackRoutes.post("/feedback", async (c) => {
  const userId = getRequestUserId(c);
  const client = getSupabaseAdmin(c);

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  try {
    const result = await sendFeedbackEmail(client, userId, body);
    return c.json(result);
  } catch (error) {
    if (error instanceof FeedbackServiceError) {
      return c.json({ error: error.message }, error.status);
    }
    throw error;
  }
});
