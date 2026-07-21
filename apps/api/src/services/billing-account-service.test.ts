/**
 * apps/api/src/services/billing-account-service.test.ts
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createInMemorySupabase } from "@tradingagents/supabase/test";
import { HOSTED_MONTHLY_COMPUTE_CREDIT_ALLOWANCE } from "@tradingagents/api-types";
import {
  activateScaffoldSubscription,
  getBillingAccount,
  userHasActiveSubscription,
} from "./billing-account-service.js";

describe("billing-account-service", () => {
  it("activates a hosted scaffold subscription with sample usage", async () => {
    const userId = `user-hosted-${Date.now()}`;
    const client = createInMemorySupabase();

    await activateScaffoldSubscription(client, userId, "hosted", "monthly");
    const account = await getBillingAccount(client, userId);

    assert.equal(account.subscription.planId, "hosted");
    assert.equal(account.subscription.status, "active");
    assert.ok(account.subscription.currentPeriodEnd);
    assert.ok(account.usage);
    assert.equal(account.usage?.isSample, true);
    assert.equal(account.usage?.allowanceComputeCredits, HOSTED_MONTHLY_COMPUTE_CREDIT_ALLOWANCE);
    assert.equal(account.usage?.baseAllowanceComputeCredits, HOSTED_MONTHLY_COMPUTE_CREDIT_ALLOWANCE);
    assert.equal(account.usage?.rolloverComputeCredits, 0);
    assert.equal(account.usage?.blockedLowBalance, false);
    assert.ok((account.usage?.byModel.length ?? 0) > 0);
    assert.ok((account.usage?.selfPayTokens ?? 0) > 0);
    assert.ok((account.usage?.usedComputeCredits ?? 0) > 0);
    assert.ok((account.usage?.byModel[0]?.creditMultiplier ?? 0) > 0);
  });

  it("returns empty subscription for unknown users", async () => {
    const account = await getBillingAccount(createInMemorySupabase(), "missing-user");
    assert.equal(account.subscription.status, "none");
    assert.equal(account.usage, null);
  });

  it("userHasActiveSubscription requires an active byok or hosted plan", () => {
    assert.equal(
      userHasActiveSubscription({
        planId: null,
        interval: null,
        status: "none",
        currentPeriodStart: null,
        currentPeriodEnd: null,
      }),
      false,
    );
    assert.equal(
      userHasActiveSubscription({
        planId: "byok",
        interval: "monthly",
        status: "canceled",
        currentPeriodStart: null,
        currentPeriodEnd: null,
      }),
      false,
    );
    assert.equal(
      userHasActiveSubscription({
        planId: "hosted",
        interval: "monthly",
        status: "active",
        currentPeriodStart: "2026-07-01T00:00:00.000Z",
        currentPeriodEnd: "2099-08-01T00:00:00.000Z",
      }),
      true,
    );
    assert.equal(
      userHasActiveSubscription({
        planId: "hosted",
        interval: "monthly",
        status: "active",
        currentPeriodStart: "2026-06-01T00:00:00.000Z",
        currentPeriodEnd: "2026-07-01T00:00:00.000Z",
      }),
      false,
    );
  });
});
