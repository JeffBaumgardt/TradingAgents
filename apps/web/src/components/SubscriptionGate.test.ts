/**
 * @file apps/web/src/components/SubscriptionGate.test.ts
 * Unit tests for SubscriptionGate access orchestration (evaluateSubscriptionGate).
 *
 * Web tests run under node:test without a React runner; the gate's async
 * decision path is extracted to subscription-gate-check for deterministic
 * coverage of what the component renders.
 */

import assert from "node:assert/strict";
import { describe, it, mock } from "node:test";
import type { UserSubscription } from "@tradingagents/api-types";
import {
  evaluateSubscriptionGate,
  gateStateFromDecision,
  SUBSCRIPTION_GATE_POLL_ATTEMPTS,
  type BillingAccountLike,
} from "../lib/subscription-gate-check";
import { getTrialEndedModalCopy } from "../lib/trial-ended-modal-content";

function subscription(
  partial: Partial<UserSubscription> & Pick<UserSubscription, "status">,
): UserSubscription {
  return {
    planId: partial.planId ?? null,
    interval: partial.interval ?? null,
    status: partial.status,
    currentPeriodStart: partial.currentPeriodStart ?? null,
    currentPeriodEnd: partial.currentPeriodEnd ?? null,
    cancelAtPeriodEnd: partial.cancelAtPeriodEnd ?? false,
    isTrial: partial.isTrial,
    trialEndsAt: partial.trialEndsAt,
  };
}

function account(sub: UserSubscription): BillingAccountLike {
  return { subscription: sub };
}

function expiredTrial(planId: "standard" | "pro" = "pro"): UserSubscription {
  return subscription({
    planId,
    interval: "monthly",
    status: "expired",
    currentPeriodStart: "2026-07-28T00:00:00.000Z",
    currentPeriodEnd: "2026-08-11T00:00:00.000Z",
    isTrial: false,
  });
}

function activePro(): UserSubscription {
  return subscription({
    planId: "pro",
    interval: "monthly",
    status: "active",
    currentPeriodStart: "2026-07-01T00:00:00.000Z",
    currentPeriodEnd: "2099-08-01T00:00:00.000Z",
  });
}

function openTrial(): UserSubscription {
  return subscription({
    planId: "pro",
    interval: "monthly",
    status: "trialing",
    isTrial: true,
    currentPeriodStart: "2026-07-28T00:00:00.000Z",
    currentPeriodEnd: "2099-08-11T00:00:00.000Z",
  });
}

function nonePlan(): UserSubscription {
  return subscription({ status: "none", planId: null });
}

describe("SubscriptionGate evaluateSubscriptionGate", () => {
  it("returns ready for an active paid subscription without starting a trial", async () => {
    const fetchBillingAccount = mock.fn(async () => account(activePro()));
    const startBillingTrial = mock.fn(async () => {
      throw new Error("should not start trial");
    });

    const result = await evaluateSubscriptionGate(
      { fromCheckout: false },
      { fetchBillingAccount, startBillingTrial },
    );

    assert.deepEqual(result, { kind: "ready" });
    assert.equal(fetchBillingAccount.mock.callCount(), 1);
    assert.equal(startBillingTrial.mock.callCount(), 0);
  });

  it("returns ready for an open free trial without restarting trial", async () => {
    const startBillingTrial = mock.fn(async () => {
      throw new Error("should not start trial");
    });

    const result = await evaluateSubscriptionGate(
      { fromCheckout: false },
      {
        fetchBillingAccount: async () => account(openTrial()),
        startBillingTrial,
      },
    );

    assert.deepEqual(result, { kind: "ready" });
    assert.equal(startBillingTrial.mock.callCount(), 0);
  });

  it("shows trial_expired modal state when the free trial has ended (day 14)", async () => {
    const expired = expiredTrial("pro");
    const startBillingTrial = mock.fn(async () => {
      throw new Error("should not restart trial");
    });

    const result = await evaluateSubscriptionGate(
      { fromCheckout: false },
      {
        fetchBillingAccount: async () => account(expired),
        startBillingTrial,
      },
    );

    assert.equal(result.kind, "trial_expired");
    if (result.kind !== "trial_expired") {
      return;
    }
    assert.equal(result.subscription.status, "expired");
    assert.equal(result.subscription.planId, "pro");
    assert.equal(startBillingTrial.mock.callCount(), 0);

    // Component maps this state to TrialEndedModal variant="trial_expired"
    const copy = getTrialEndedModalCopy("trial_expired");
    assert.equal(copy.title, "Your free trial is over");
  });

  it("shows trial_expired for Standard day-14 trials", async () => {
    const result = await evaluateSubscriptionGate(
      { fromCheckout: false },
      {
        fetchBillingAccount: async () => account(expiredTrial("standard")),
        startBillingTrial: async () => {
          throw new Error("unused");
        },
      },
    );

    assert.equal(result.kind, "trial_expired");
    if (result.kind === "trial_expired") {
      assert.equal(result.subscription.planId, "standard");
    }
  });

  it("auto-starts a Pro trial for users with no plan and becomes ready", async () => {
    let fetches = 0;
    const fetchBillingAccount = mock.fn(async () => {
      fetches += 1;
      if (fetches === 1) {
        return account(nonePlan());
      }
      return account(openTrial());
    });
    const startBillingTrial = mock.fn(async (planId: "standard" | "pro") => {
      assert.equal(planId, "pro");
      return { subscription: openTrial(), trialEndsAt: openTrial().currentPeriodEnd };
    });

    const result = await evaluateSubscriptionGate(
      { fromCheckout: false },
      { fetchBillingAccount, startBillingTrial },
    );

    assert.deepEqual(result, { kind: "ready" });
    assert.equal(startBillingTrial.mock.callCount(), 1);
    assert.equal(fetchBillingAccount.mock.callCount(), 2);
  });

  it("falls through to subscription_required when trial start fails and plan stays none", async () => {
    const fetchBillingAccount = mock.fn(async () => account(nonePlan()));
    const startBillingTrial = mock.fn(async () => {
      throw new Error("A free trial has already been used for this account");
    });

    const result = await evaluateSubscriptionGate(
      { fromCheckout: false },
      { fetchBillingAccount, startBillingTrial },
    );

    assert.equal(result.kind, "subscription_required");
    if (result.kind === "subscription_required") {
      assert.equal(result.subscription.status, "none");
    }
    assert.equal(startBillingTrial.mock.callCount(), 1);
  });

  it("maps canceled paid access to subscription_required modal state", async () => {
    const canceled = subscription({
      planId: "pro",
      interval: "monthly",
      status: "canceled",
      currentPeriodStart: "2026-07-01T00:00:00.000Z",
      currentPeriodEnd: "2026-08-01T00:00:00.000Z",
    });

    const result = await evaluateSubscriptionGate(
      { fromCheckout: false },
      {
        fetchBillingAccount: async () => account(canceled),
        startBillingTrial: async () => {
          throw new Error("unused");
        },
      },
    );

    assert.equal(result.kind, "subscription_required");
    if (result.kind === "subscription_required") {
      assert.equal(result.subscription.status, "canceled");
    }
  });

  it("returns error when billing fails outside post-checkout poll", async () => {
    const result = await evaluateSubscriptionGate(
      { fromCheckout: false },
      {
        fetchBillingAccount: async () => {
          throw new Error("network down");
        },
        startBillingTrial: async () => {
          throw new Error("unused");
        },
      },
    );

    assert.deepEqual(result, { kind: "error" });
  });

  it("polls after checkout until the subscription becomes active", async () => {
    let fetches = 0;
    const waits: number[] = [];
    const fetchBillingAccount = mock.fn(async () => {
      fetches += 1;
      // Still expired until webhook lands on 3rd attempt
      if (fetches < 3) {
        return account(expiredTrial());
      }
      return account(activePro());
    });
    const startBillingTrial = mock.fn(async () => {
      throw new Error("should not start trial after expiry");
    });

    const result = await evaluateSubscriptionGate(
      { fromCheckout: true },
      {
        fetchBillingAccount,
        startBillingTrial,
        wait: async (ms) => {
          waits.push(ms);
        },
      },
    );

    assert.deepEqual(result, { kind: "ready" });
    assert.equal(fetchBillingAccount.mock.callCount(), 3);
    assert.equal(startBillingTrial.mock.callCount(), 0);
    assert.ok(waits.length >= 2);
    assert.ok(fetches <= SUBSCRIPTION_GATE_POLL_ATTEMPTS);
  });

  it("after checkout poll budget exhausts, still surfaces trial_expired", async () => {
    const fetchBillingAccount = mock.fn(async () => account(expiredTrial()));
    let waitCount = 0;

    const result = await evaluateSubscriptionGate(
      { fromCheckout: true },
      {
        fetchBillingAccount,
        startBillingTrial: async () => {
          throw new Error("unused");
        },
        wait: async () => {
          waitCount += 1;
        },
      },
    );

    assert.equal(result.kind, "trial_expired");
    assert.equal(fetchBillingAccount.mock.callCount(), SUBSCRIPTION_GATE_POLL_ATTEMPTS);
    assert.equal(waitCount, SUBSCRIPTION_GATE_POLL_ATTEMPTS - 1);
  });

  it("returns cancelled when isCancelled trips after a fetch", async () => {
    let cancelled = false;
    const result = await evaluateSubscriptionGate(
      { fromCheckout: false },
      {
        fetchBillingAccount: async () => {
          cancelled = true;
          return account(activePro());
        },
        startBillingTrial: async () => {
          throw new Error("unused");
        },
        isCancelled: () => cancelled,
      },
    );

    assert.deepEqual(result, { kind: "cancelled" });
  });
});

describe("SubscriptionGate gateStateFromDecision", () => {
  it("maps trial_expired and try_start_trial decisions to UI states", () => {
    const expired = expiredTrial();
    assert.deepEqual(gateStateFromDecision({ kind: "trial_expired" }, expired), {
      kind: "trial_expired",
      subscription: expired,
    });
    assert.deepEqual(gateStateFromDecision({ kind: "try_start_trial" }, nonePlan()), {
      kind: "subscription_required",
      subscription: nonePlan(),
    });
    assert.deepEqual(gateStateFromDecision({ kind: "ready" }, activePro()), {
      kind: "ready",
    });
  });
});

describe("SubscriptionGate UI mapping contract", () => {
  /**
   * Documents what the React component renders for each settled state.
   * Mirror of switch in SubscriptionGate.tsx.
   */
  function uiKindForState(
    state: Awaited<ReturnType<typeof evaluateSubscriptionGate>>,
  ): "children" | "trial_ended_modal" | "subscription_required_modal" | "error" | "cancelled" {
    if (state.kind === "ready") {
      return "children";
    }
    if (state.kind === "trial_expired") {
      return "trial_ended_modal";
    }
    if (state.kind === "subscription_required") {
      return "subscription_required_modal";
    }
    if (state.kind === "cancelled") {
      return "cancelled";
    }
    return "error";
  }

  it("renders TrialEndedModal for day-14 expired trial; children for active", async () => {
    const expiredResult = await evaluateSubscriptionGate(
      { fromCheckout: false },
      {
        fetchBillingAccount: async () => account(expiredTrial()),
        startBillingTrial: async () => undefined,
      },
    );
    assert.equal(uiKindForState(expiredResult), "trial_ended_modal");

    const readyResult = await evaluateSubscriptionGate(
      { fromCheckout: false },
      {
        fetchBillingAccount: async () => account(activePro()),
        startBillingTrial: async () => undefined,
      },
    );
    assert.equal(uiKindForState(readyResult), "children");
  });
});
