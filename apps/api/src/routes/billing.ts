/**
 * apps/api/src/routes/billing.ts
 *
 * Public billing catalog + authenticated account/usage + Managed Payments checkout.
 */

import { Hono } from "hono";
import { getSupabaseAdmin } from "@tradingagents/supabase";
import {
  getOptionalRequestUserId,
  getRequestUserId,
  optionalUserId,
  requireUserId,
} from "../middleware/user-context.js";
import { listHostedModelsFromDb } from "../services/model-catalog-service.js";
import { getBillingAccount, cancelSubscriptionAtPeriodEnd, BillingAccountError } from "../services/billing-account-service.js";
import {
  BillingServiceError,
  createCheckoutSession,
  listBillingPlans,
} from "../services/billing-service.js";

export const billingRoutes = new Hono();

billingRoutes.get("/billing/plans", (c) => {
  return c.json(listBillingPlans());
});

billingRoutes.get("/billing/models", async (c) => {
  try {
    const client = getSupabaseAdmin(c);
    return c.json(await listHostedModelsFromDb(client));
  } catch {
    // Tests and misconfigured contexts still get the static catalog.
    const { listHostedModelCatalog } = await import("@tradingagents/api-types");
    return c.json(listHostedModelCatalog());
  }
});

billingRoutes.use("/billing/account", requireUserId());
billingRoutes.get("/billing/account", async (c) => {
  const userId = getRequestUserId(c);
  const client = getSupabaseAdmin(c);
  const account = await getBillingAccount(client, userId);
  return c.json(account);
});

billingRoutes.use("/billing/subscription/cancel", requireUserId());
billingRoutes.post("/billing/subscription/cancel", async (c) => {
  const userId = getRequestUserId(c);
  const client = getSupabaseAdmin(c);
  try {
    const result = await cancelSubscriptionAtPeriodEnd(client, userId);
    return c.json(result);
  } catch (error) {
    if (error instanceof BillingAccountError) {
      return c.json(
        { error: error.message },
        error.status as 400 | 502,
      );
    }
    throw error;
  }
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
    const status = result.status === "ready" ? 200 : 501;
    return c.json(result, status);
  } catch (error) {
    if (error instanceof BillingServiceError) {
      return c.json(
        { error: error.message },
        error.status as 400 | 401 | 500 | 502,
      );
    }
    throw error;
  }
});
