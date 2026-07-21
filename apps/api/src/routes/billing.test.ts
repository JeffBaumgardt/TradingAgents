/**
 * apps/api/src/routes/billing.test.ts
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Hono } from "hono";
import { billingRoutes } from "./billing.js";

describe("billing routes", () => {
  const app = new Hono();
  app.route("/", billingRoutes);

  it("lists plans", async () => {
    const response = await app.request("/billing/plans");
    assert.equal(response.status, 200);
    const body = (await response.json()) as {
      plans: Array<{ id: string; monthlyPriceCents: number }>;
    };
    assert.equal(body.plans.length, 2);
    assert.equal(body.plans[0]?.id, "byok");
    assert.equal(body.plans[0]?.monthlyPriceCents, 300);
  });

  it("returns 501 scaffold for checkout", async () => {
    const response = await app.request("/billing/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ planId: "hosted", interval: "monthly" }),
    });
    assert.equal(response.status, 501);
    const body = (await response.json()) as {
      status: string;
      checkoutUrl: string | null;
      subscriptionActivated?: boolean;
    };
    assert.equal(body.status, "not_configured");
    assert.equal(body.checkoutUrl, null);
    assert.equal(body.subscriptionActivated, false);
  });

  it("requires auth for billing account", async () => {
    const response = await app.request("/billing/account");
    assert.equal(response.status, 401);
  });

  it("returns 400 for invalid checkout JSON body", async () => {
    const response = await app.request("/billing/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{",
    });
    assert.equal(response.status, 400);
  });
});
