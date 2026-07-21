/**
 * @file apps/web/src/components/SiteHeaderNav.tsx
 * Slim primary nav — account settings live in the Clerk UserButton menu.
 */

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useUserSession } from "@/context/UserSessionContext";
import { fetchBillingAccount } from "@/lib/api-client";
import { hasActiveSubscription } from "@/lib/subscription-access";
import styles from "./SiteHeader.module.css";

export default function SiteHeaderNav() {
  const { credentialsReady } = useUserSession();
  const [showPricing, setShowPricing] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadSubscription() {
      try {
        const account = await fetchBillingAccount();
        if (!cancelled) {
          setShowPricing(!hasActiveSubscription(account.subscription));
        }
      } catch {
        if (!cancelled) {
          setShowPricing(true);
        }
      }
    }

    void loadSubscription();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <nav className={styles.nav} aria-label="Main">
      {credentialsReady ? (
        <Link href="/dashboard" className={styles.navLink}>
          Start analysis
        </Link>
      ) : null}
      {showPricing ? (
        <Link href="/pricing" className={styles.navLink}>
          Pricing
        </Link>
      ) : null}
    </nav>
  );
}
