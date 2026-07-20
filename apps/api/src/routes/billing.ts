/**
 * apps/api/src/routes/billing.ts
 *
 * Public billing catalog + checkout scaffold (payment provider TBD).
 */

import { Hono } from "hono";
import {
  BillingServiceError,
  createCheckoutSession,
  listBillingPlans,
} from "../services/billing-service.js";

export const billingRoutes = new Hono();

billingRoutes.get("/billing/plans", (c) => {
  return c.json(listBillingPlans());
});

billingRoutes.post("/billing/checkout", async (c) => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  try {
    const result = createCheckoutSession(body);
    // 501 signals the route exists but the payment provider is not wired yet.
    return c.json(result, 501);
  } catch (error) {
    if (error instanceof BillingServiceError) {
      return c.json({ error: error.message }, error.status as 400);
    }
    throw error;
  }
});
