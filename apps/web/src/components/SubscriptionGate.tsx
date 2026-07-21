/**
 * @file apps/web/src/components/SubscriptionGate.tsx
 * Redirects to pricing when the user has no active BYOK or Hosted subscription.
 * Retries briefly after Stripe Checkout so the webhook can land first.
 */

"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import HomePageSkeleton from "@/components/HomePageSkeleton";
import { fetchBillingAccount } from "@/lib/api-client";
import { hasActiveSubscription } from "@/lib/subscription-access";

interface SubscriptionGateProps {
  children: ReactNode;
}

/** ~20s budget covers Stripe webhook latency and API cold starts. */
const POLL_ATTEMPTS = 20;
const POLL_INTERVAL_MS = 1000;

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export default function SubscriptionGate({ children }: SubscriptionGateProps) {
  const router = useRouter();
  const [allowed, setAllowed] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function checkSubscription() {
      for (let attempt = 0; attempt < POLL_ATTEMPTS; attempt += 1) {
        try {
          const account = await fetchBillingAccount();
          if (cancelled) {
            return;
          }
          if (hasActiveSubscription(account.subscription)) {
            setAllowed(true);
            return;
          }
        } catch {
          // Keep polling — a transient API blip after checkout should not
          // immediately bounce the user to pricing.
        }

        if (attempt < POLL_ATTEMPTS - 1) {
          await wait(POLL_INTERVAL_MS);
        }
      }

      if (!cancelled) {
        setAllowed(false);
      }
    }

    void checkSubscription();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (allowed === false) {
      router.replace("/pricing");
    }
  }, [allowed, router]);

  if (allowed === null) {
    return <HomePageSkeleton />;
  }

  if (!allowed) {
    return null;
  }

  return children;
}
