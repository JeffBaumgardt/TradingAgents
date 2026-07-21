/**
 * apps/api/src/services/billing-account-service.test.ts
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { HOSTED_MONTHLY_BILLABLE_ALLOWANCE } from "@tradingagents/api-types";
import {
  activateScaffoldSubscription,
  getBillingAccount,
} from "./billing-account-service.js";

describe("billing-account-service", () => {
  it("activates a hosted scaffold subscription with sample usage", async () => {
    const userId = `user-hosted-${Date.now()}`;
    const client = {} as never;

    await activateScaffoldSubscription(client, userId, "hosted", "monthly");
    const account = await getBillingAccount(client, userId);

    assert.equal(account.subscription.planId, "hosted");
    assert.equal(account.subscription.status, "active");
    assert.ok(account.subscription.currentPeriodEnd);
    assert.ok(account.usage);
    assert.equal(account.usage?.isSample, true);
    assert.equal(account.usage?.allowanceBillableUnits, HOSTED_MONTHLY_BILLABLE_ALLOWANCE);
    assert.ok((account.usage?.byModel.length ?? 0) > 0);
    assert.ok((account.usage?.selfPayTokens ?? 0) > 0);
    assert.ok((account.usage?.usedBillableUnits ?? 0) > 0);
  });

  it("returns empty subscription for unknown users", async () => {
    const account = await getBillingAccount({} as never, "missing-user");
    assert.equal(account.subscription.status, "none");
    assert.equal(account.usage, null);
  });
});
