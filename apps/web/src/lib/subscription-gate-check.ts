/**
 * @file apps/web/src/lib/subscription-gate-check.ts
 * Pure access-check orchestration used by SubscriptionGate.
 * Inject dependencies in tests (billing fetch, trial start, wait).
 */

import type { UserSubscription } from "@tradingagents/api-types";
import {
  resolveSubscriptionGateDecision,
  type SubscriptionGateDecision,
} from "./subscription-access";

/** ~20s budget covers Stripe webhook latency and API cold starts. */
export const SUBSCRIPTION_GATE_POLL_ATTEMPTS = 20;
export const SUBSCRIPTION_GATE_POLL_INTERVAL_MS = 1000;

export type SubscriptionGateState =
  | { kind: "loading" }
  | { kind: "error" }
  | { kind: "ready" }
  | { kind: "trial_expired"; subscription: UserSubscription }
  | { kind: "subscription_required"; subscription: UserSubscription }
  | { kind: "cancelled" };

export interface BillingAccountLike {
  subscription: UserSubscription;
}

export interface SubscriptionGateCheckDeps {
  fetchBillingAccount: () => Promise<BillingAccountLike>;
  startBillingTrial: (planId: "standard" | "pro") => Promise<unknown>;
  /** Override sleep between poll attempts (default: real setTimeout). */
  wait?: (ms: number) => Promise<void>;
  /** When true mid-check, abort without a UI settlement state. */
  isCancelled?: () => boolean;
}

function defaultWait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export function gateStateFromDecision(
  decision: SubscriptionGateDecision,
  subscription: UserSubscription,
): Exclude<SubscriptionGateState, { kind: "loading" | "error" | "cancelled" }> {
  if (decision.kind === "ready") {
    return { kind: "ready" };
  }
  if (decision.kind === "trial_expired") {
    return { kind: "trial_expired", subscription };
  }
  // try_start_trial only applies before we attempt start; after settle without
  // access treat as paywall required.
  return { kind: "subscription_required", subscription };
}

/**
 * Resolve what SubscriptionGate should render after loading billing state.
 * Does not include the transient loading spinner state.
 */
export async function evaluateSubscriptionGate(
  options: { fromCheckout: boolean },
  deps: SubscriptionGateCheckDeps,
): Promise<Exclude<SubscriptionGateState, { kind: "loading" }>> {
  const wait = deps.wait ?? defaultWait;
  const isCancelled = deps.isCancelled ?? (() => false);

  let sawSuccessfulResponse = false;
  let lastSubscription: UserSubscription | null = null;
  let triedTrial = false;
  const maxAttempts = options.fromCheckout ? SUBSCRIPTION_GATE_POLL_ATTEMPTS : 1;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      let account = await deps.fetchBillingAccount();
      if (isCancelled()) {
        return { kind: "cancelled" };
      }
      sawSuccessfulResponse = true;
      lastSubscription = account.subscription;

      let decision = resolveSubscriptionGateDecision(account.subscription);

      if (decision.kind === "ready") {
        return { kind: "ready" };
      }

      if (decision.kind === "try_start_trial" && !triedTrial) {
        triedTrial = true;
        try {
          await deps.startBillingTrial("pro");
          account = await deps.fetchBillingAccount();
          if (isCancelled()) {
            return { kind: "cancelled" };
          }
          lastSubscription = account.subscription;
          decision = resolveSubscriptionGateDecision(account.subscription);
          if (decision.kind === "ready") {
            return { kind: "ready" };
          }
        } catch {
          decision = resolveSubscriptionGateDecision(account.subscription);
        }
      }

      // Outside post-checkout polling, settle blocked states immediately.
      if (!options.fromCheckout || attempt === maxAttempts - 1) {
        if (decision.kind === "ready") {
          return { kind: "ready" };
        }
        return gateStateFromDecision(decision, account.subscription);
      }
    } catch {
      if (!options.fromCheckout) {
        return { kind: "error" };
      }
    }

    if (attempt < maxAttempts - 1) {
      await wait(SUBSCRIPTION_GATE_POLL_INTERVAL_MS);
      if (isCancelled()) {
        return { kind: "cancelled" };
      }
    }
  }

  if (!sawSuccessfulResponse || !lastSubscription) {
    return { kind: "error" };
  }

  const decision = resolveSubscriptionGateDecision(lastSubscription);
  if (decision.kind === "ready") {
    return { kind: "ready" };
  }
  return gateStateFromDecision(decision, lastSubscription);
}
