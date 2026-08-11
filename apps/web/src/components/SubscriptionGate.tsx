/**
 * @file apps/web/src/components/SubscriptionGate.tsx
 * App-shell access control for Standard/Pro (including free trial).
 * - New users auto-start a Pro trial.
 * - Active / trialing users pass through.
 * - Expired trial (and other blocked states) get a non-closeable subscribe modal.
 * - After Checkout, polls briefly so the Stripe webhook can activate access.
 */

"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import HomePageSkeleton from "@/components/HomePageSkeleton";
import TrialEndedModal from "@/components/TrialEndedModal";
import { fetchBillingAccount, startBillingTrial } from "@/lib/api-client";
import {
  evaluateSubscriptionGate,
  type SubscriptionGateState,
} from "@/lib/subscription-gate-check";

interface SubscriptionGateProps {
  children: ReactNode;
}

type UiGateState = Exclude<SubscriptionGateState, { kind: "cancelled" }>;

export default function SubscriptionGate({ children }: SubscriptionGateProps) {
  const searchParams = useSearchParams();
  const fromCheckout = searchParams.get("checkout") === "1";
  const [state, setState] = useState<UiGateState>({ kind: "loading" });
  const [retryToken, setRetryToken] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function checkSubscription() {
      setState({ kind: "loading" });
      const result = await evaluateSubscriptionGate(
        { fromCheckout },
        {
          fetchBillingAccount,
          startBillingTrial,
          isCancelled: () => cancelled,
        },
      );
      if (cancelled || result.kind === "cancelled") {
        return;
      }
      setState(result);
    }

    void checkSubscription();
    return () => {
      cancelled = true;
    };
  }, [retryToken, fromCheckout]);

  function handleRetry() {
    setRetryToken((token) => token + 1);
  }

  if (state.kind === "error") {
    return (
      <div role="alert" aria-live="polite" style={{ padding: "2rem", textAlign: "center" }}>
        <p>Could not verify your subscription. Check your connection and try again.</p>
        <button type="button" onClick={handleRetry} aria-label="Retry subscription check">
          Retry
        </button>
      </div>
    );
  }

  if (state.kind === "loading") {
    return <HomePageSkeleton />;
  }

  if (state.kind === "trial_expired") {
    return <TrialEndedModal variant="trial_expired" />;
  }

  if (state.kind === "subscription_required") {
    return <TrialEndedModal variant="subscription_required" />;
  }

  return children;
}
