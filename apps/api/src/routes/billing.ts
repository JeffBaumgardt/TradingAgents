/**
 * apps/api/src/routes/billing.ts
 *
 * Public billing catalog + authenticated account/usage + checkout scaffold.
 */

import { Hono } from "hono";
import { getSupabaseAdmin } from "@tradingagents/supabase";
import {
  getOptionalRequestUserId,
  getRequestUserId,
  optionalUserId,
  requireUserId,
} from "../middleware/user-context.js";
import { getBillingAccount } from "../services/billing-account-service.js";
import {
  BillingServiceError,
  createCheckoutSession,
  listBillingPlans,
} from "../services/billing-service.js";

export const billingRoutes = new Hono();

billingRoutes.get("/billing/plans", (c) => {
  return c.json(listBillingPlans());
});

billingRoutes.use("/billing/account", requireUserId());
billingRoutes.get("/billing/account", async (c) => {
  const userId = getRequestUserId(c);
  const client = getSupabaseAdmin(c);
  const account = await getBillingAccount(client, userId);
  return c.json(account);
});

billingRoutes.use("/billing/checkout", optionalUserId());
billingRoutes.post("/billing/checkout", async (c) => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  try {
    const userId = getOptionalRequestUserId(c) ?? null;
    const client = userId ? getSupabaseAdmin(c) : null;
    const result = await createCheckoutSession(body, { userId, client });
    return c.json(result, 501);
  } catch (error) {
    if (error instanceof BillingServiceError) {
      return c.json({ error: error.message }, error.status as 400);
    }
    throw error;
  }
});
