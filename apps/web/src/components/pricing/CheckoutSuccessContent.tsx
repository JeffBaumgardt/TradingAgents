/**
 * @file apps/web/src/components/pricing/CheckoutSuccessContent.tsx
 * Success copy after Stripe redirects back from Managed Payments Checkout.
 */

"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import pricingStyles from "./PricingLayout.module.css";
import styles from "./CheckoutScaffold.module.css";

export default function CheckoutSuccessContent() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session_id");

  return (
    <div className={styles.page}>
      <Link href="/pricing" className={styles.backLink}>
        ← Back to pricing
      </Link>

      <header className={styles.header}>
        <p className={pricingStyles.eyebrow}>Checkout</p>
        <h1 className={styles.title}>Thanks for subscribing</h1>
        <p className={styles.intro}>
          Your payment went through. Subscription access activates when Stripe
          confirms checkout (usually within a few seconds). You can open the
          dashboard or review billing anytime.
        </p>
      </header>

      <div className={styles.actions}>
        <Link
          href="/dashboard?checkout=1"
          className={styles.primaryButton}
          aria-label="Go to dashboard"
        >
          Go to dashboard
        </Link>
        <Link
          href="/settings/billing"
          className={styles.secondaryButton}
          aria-label="View billing and usage"
        >
          Billing & usage
        </Link>
      </div>
    </div>
  );
}
