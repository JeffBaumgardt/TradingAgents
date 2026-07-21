/**
 * @file apps/web/src/components/SubscriptionGate.tsx
 * Blocks analysis UI until the user has an active BYOK or Hosted subscription.
 */

"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import HomePageSkeleton from "@/components/HomePageSkeleton";
import { fetchBillingAccount } from "@/lib/api-client";
import { hasActiveSubscription } from "@/lib/subscription-access";
import styles from "./SubscriptionGate.module.css";

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
      router.prefetch("/pricing");
    }
  }, [allowed, router]);

  if (allowed === null) {
    return <HomePageSkeleton />;
  }

  if (!allowed) {
    return (
      <section className={styles.gate} aria-labelledby="subscription-gate-heading">
        <h1 id="subscription-gate-heading" className={styles.title}>
          Choose a plan to run analyses
        </h1>
        <p className={styles.copy}>
          An active subscription is required before starting multi-agent model runs. Bring your own
          key starts at $3/month for infrastructure, or pick Hosted models for a wider catalog.
        </p>
        <div className={styles.actions}>
          <Link href="/pricing" className={styles.primary}>
            View pricing
          </Link>
          <Link href="/checkout?plan=byok&interval=monthly" className={styles.secondary}>
            Start with BYOK
          </Link>
        </div>
      </section>
    );
  }

  return children;
}
