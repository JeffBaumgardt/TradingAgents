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
    assert.equal(body.plans[0]?.id, "standard");
    assert.equal(body.plans[0]?.monthlyPriceCents, 900);
  });

  it("lists curated Agents Model catalog with in/out credit rates", async () => {
    const response = await app.request("/billing/models");
    assert.equal(response.status, 200);
    const body = (await response.json()) as {
      pricedAsOf: string;
      referenceOutputUsdPer1M: number;
      models: Array<{
        providerId: string;
        modelId: string;
        inputUsdPer1M: number;
        outputUsdPer1M: number;
        inputCreditsPerToken: number;
        outputCreditsPerToken: number;
      }>;
    };
    assert.equal(body.models.length, 1);
    assert.equal(body.referenceOutputUsdPer1M, 10);
    const agents = body.models.find((model) => model.modelId === "claude-sonnet-5");
    assert.ok(agents);
    assert.equal(agents?.providerId, "anthropic");
    assert.equal(agents?.inputUsdPer1M, 2);
    assert.equal(agents?.outputUsdPer1M, 10);
    assert.equal(agents?.inputCreditsPerToken, 1.05);
    assert.equal(agents?.outputCreditsPerToken, 5.25);
  });

  it("returns 501 scaffold for checkout", async () => {
    const response = await app.request("/billing/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ planId: "pro", interval: "monthly" }),
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

  it("requires auth for subscription cancel", async () => {
    const response = await app.request("/billing/subscription/cancel", {
      method: "POST",
    });
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
