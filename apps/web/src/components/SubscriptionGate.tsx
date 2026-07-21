/**
 * @file apps/web/src/components/SubscriptionGate.tsx
 * Redirects to pricing when the user has no active BYOK or Hosted subscription.
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

export default function SubscriptionGate({ children }: SubscriptionGateProps) {
  const router = useRouter();
  const [allowed, setAllowed] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function checkSubscription() {
      try {
        const account = await fetchBillingAccount();
        if (!cancelled) {
          setAllowed(hasActiveSubscription(account.subscription));
        }
      } catch {
        if (!cancelled) {
          setAllowed(false);
        }
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
