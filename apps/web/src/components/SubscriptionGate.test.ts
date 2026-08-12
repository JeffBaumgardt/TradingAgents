/**
 * @file apps/web/src/components/SubscriptionGate.test.ts
 * Unit tests for SubscriptionGate access orchestration (evaluateSubscriptionGate).
 *
 * Pure orchestration tests (no React render). The gate's async decision
 * path is extracted to subscription-gate-check for deterministic coverage.
 */

import { describe, it, expect, vi } from "vitest";
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
    const fetchBillingAccount = vi.fn(async () => account(activePro()));
    const startBillingTrial = vi.fn(async () => {
      throw new Error("should not start trial");
    });

    const result = await evaluateSubscriptionGate(
      { fromCheckout: false },
      { fetchBillingAccount, startBillingTrial },
    );

    expect(result).toEqual({ kind: "ready" });
    expect(fetchBillingAccount.mock.calls.length).toBe(1);
    expect(startBillingTrial.mock.calls.length).toBe(0);
  });

  it("returns ready for an open free trial without restarting trial", async () => {
    const startBillingTrial = vi.fn(async () => {
      throw new Error("should not start trial");
    });

    const result = await evaluateSubscriptionGate(
      { fromCheckout: false },
      {
        fetchBillingAccount: async () => account(openTrial()),
        startBillingTrial,
      },
    );

    expect(result).toEqual({ kind: "ready" });
    expect(startBillingTrial.mock.calls.length).toBe(0);
  });

  it("shows trial_expired modal state when the free trial has ended (day 14)", async () => {
    const expired = expiredTrial("pro");
    const startBillingTrial = vi.fn(async () => {
      throw new Error("should not restart trial");
    });

    const result = await evaluateSubscriptionGate(
      { fromCheckout: false },
      {
        fetchBillingAccount: async () => account(expired),
        startBillingTrial,
      },
    );

    expect(result.kind).toBe("trial_expired");
    if (result.kind !== "trial_expired") {
      return;
    }
    expect(result.subscription.status).toBe("expired");
    expect(result.subscription.planId).toBe("pro");
    expect(startBillingTrial.mock.calls.length).toBe(0);

    // Component maps this state to TrialEndedModal variant="trial_expired"
    const copy = getTrialEndedModalCopy("trial_expired");
    expect(copy.title).toBe("Your free trial is over");
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

    expect(result.kind).toBe("trial_expired");
    if (result.kind === "trial_expired") {
      expect(result.subscription.planId).toBe("standard");
    }
  });

  it("auto-starts a Pro trial for users with no plan and becomes ready", async () => {
    let fetches = 0;
    const fetchBillingAccount = vi.fn(async () => {
      fetches += 1;
      if (fetches === 1) {
        return account(nonePlan());
      }
      return account(openTrial());
    });
    const startBillingTrial = vi.fn(async (planId: "standard" | "pro") => {
      expect(planId).toBe("pro");
      return { subscription: openTrial(), trialEndsAt: openTrial().currentPeriodEnd };
    });

    const result = await evaluateSubscriptionGate(
      { fromCheckout: false },
      { fetchBillingAccount, startBillingTrial },
    );

    expect(result).toEqual({ kind: "ready" });
    expect(startBillingTrial.mock.calls.length).toBe(1);
    expect(fetchBillingAccount.mock.calls.length).toBe(2);
  });

  it("falls through to subscription_required when trial start fails and plan stays none", async () => {
    const fetchBillingAccount = vi.fn(async () => account(nonePlan()));
    const startBillingTrial = vi.fn(async () => {
      throw new Error("A free trial has already been used for this account");
    });

    const result = await evaluateSubscriptionGate(
      { fromCheckout: false },
      { fetchBillingAccount, startBillingTrial },
    );

    expect(result.kind).toBe("subscription_required");
    if (result.kind === "subscription_required") {
      expect(result.subscription.status).toBe("none");
    }
    expect(startBillingTrial.mock.calls.length).toBe(1);
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

    expect(result.kind).toBe("subscription_required");
    if (result.kind === "subscription_required") {
      expect(result.subscription.status).toBe("canceled");
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

    expect(result).toEqual({ kind: "error" });
  });

  it("polls after checkout until the subscription becomes active", async () => {
    let fetches = 0;
    const waits: number[] = [];
    const fetchBillingAccount = vi.fn(async () => {
      fetches += 1;
      // Still expired until webhook lands on 3rd attempt
      if (fetches < 3) {
        return account(expiredTrial());
      }
      return account(activePro());
    });
    const startBillingTrial = vi.fn(async () => {
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

    expect(result).toEqual({ kind: "ready" });
    expect(fetchBillingAccount.mock.calls.length).toBe(3);
    expect(startBillingTrial.mock.calls.length).toBe(0);
    expect(waits.length >= 2).toBeTruthy();
    expect(fetches <= SUBSCRIPTION_GATE_POLL_ATTEMPTS).toBeTruthy();
  });

  it("after checkout poll budget exhausts, still surfaces trial_expired", async () => {
    const fetchBillingAccount = vi.fn(async () => account(expiredTrial()));
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

    expect(result.kind).toBe("trial_expired");
    expect(fetchBillingAccount.mock.calls.length).toBe(SUBSCRIPTION_GATE_POLL_ATTEMPTS);
    expect(waitCount).toBe(SUBSCRIPTION_GATE_POLL_ATTEMPTS - 1);
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

    expect(result).toEqual({ kind: "cancelled" });
  });
});

describe("SubscriptionGate gateStateFromDecision", () => {
  it("maps trial_expired and try_start_trial decisions to UI states", () => {
    const expired = expiredTrial();
    expect(gateStateFromDecision({ kind: "trial_expired" }, expired)).toEqual({
      kind: "trial_expired",
      subscription: expired,
    });
    expect(gateStateFromDecision({ kind: "try_start_trial" }, nonePlan())).toEqual({
      kind: "subscription_required",
      subscription: nonePlan(),
    });
    expect(gateStateFromDecision({ kind: "ready" }, activePro())).toEqual({
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
    expect(uiKindForState(expiredResult)).toBe("trial_ended_modal");

    const readyResult = await evaluateSubscriptionGate(
      { fromCheckout: false },
      {
        fetchBillingAccount: async () => account(activePro()),
        startBillingTrial: async () => undefined,
      },
    );
    expect(uiKindForState(readyResult)).toBe("children");
  });
});
