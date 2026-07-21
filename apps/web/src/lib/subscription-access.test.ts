/**
 * @file apps/web/src/lib/subscription-access.test.ts
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { hasActiveSubscription } from "./subscription-access";

describe("hasActiveSubscription", () => {
  it("requires an active byok or hosted plan", () => {
    assert.equal(hasActiveSubscription(null), false);
    assert.equal(
      hasActiveSubscription({
        planId: null,
        interval: null,
        status: "none",
        currentPeriodStart: null,
        currentPeriodEnd: null,
      }),
      false,
    );
    assert.equal(
      hasActiveSubscription({
        planId: "byok",
        interval: "monthly",
        status: "canceled",
        currentPeriodStart: null,
        currentPeriodEnd: null,
      }),
      false,
    );
    assert.equal(
      hasActiveSubscription({
        planId: "byok",
        interval: "monthly",
        status: "active",
        currentPeriodStart: "2026-07-01T00:00:00.000Z",
        currentPeriodEnd: "2099-08-01T00:00:00.000Z",
      }),
      true,
    );
    assert.equal(
      hasActiveSubscription({
        planId: "hosted",
        interval: "annual",
        status: "active",
        currentPeriodStart: "2026-07-01T00:00:00.000Z",
        currentPeriodEnd: "2099-07-01T00:00:00.000Z",
      }),
      true,
    );
    assert.equal(
      hasActiveSubscription({
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
