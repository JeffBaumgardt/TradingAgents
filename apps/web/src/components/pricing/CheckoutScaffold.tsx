/**
 * @file apps/web/src/components/pricing/CheckoutScaffold.tsx
 * Checkout entry UI — calls the billing API scaffold (Stripe later).
 */

"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { createCheckoutSession, ApiClientError } from "@/lib/api-client";
import {
  displayPriceCaption,
  displayPriceCents,
  formatUsdFromCents,
  getPricingPlan,
  isBillingInterval,
  isPricingPlanId,
  type BillingInterval,
  type BillingPlanId,
} from "@/lib/pricing-content";
import shared from "./pricing-shared.module.css";
import styles from "./CheckoutScaffold.module.css";

export default function CheckoutScaffold() {
  const searchParams = useSearchParams();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const planParam = searchParams.get("plan");
  const intervalParam = searchParams.get("interval");
  const planId: BillingPlanId = isPricingPlanId(planParam) ? planParam : "byok";
  const interval: BillingInterval = isBillingInterval(intervalParam)
    ? intervalParam
    : "monthly";
  const plan = getPricingPlan(planId);
  const price = displayPriceCents(plan, interval);

  async function handleContinueToPayment() {
    setPending(true);
    setError(null);
    setMessage(null);

    try {
      const result = await createCheckoutSession({
        planId,
        interval,
      });
      setMessage(
        result.message ??
          "Checkout is scaffolded. Payment provider integration comes next.",
      );
    } catch (caught) {
      if (caught instanceof ApiClientError) {
        setError(caught.message);
      } else {
        setError("Could not start checkout. Please try again later.");
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <div className={styles.page}>
      <Link href="/pricing" className={styles.backLink}>
        ← Back to pricing
      </Link>

      <header className={styles.header}>
        <p className={shared.eyebrow}>Checkout</p>
        <h1 className={styles.title}>Review your plan</h1>
        <p className={styles.intro}>
          Payment processing is not live yet. Continuing will call the billing API scaffold and
          return a clear “not configured” response until Stripe (or similar) is wired up.
        </p>
      </header>

      <section className={styles.summary} aria-labelledby="checkout-summary-heading">
        <h2 id="checkout-summary-heading" className={styles.summaryTitle}>
          {plan.name}
          {plan.priceProvisional ? (
            <span className={shared.provisional}>Provisional</span>
          ) : null}
        </h2>
        <p className={styles.summaryTagline}>{plan.tagline}</p>
        <p className={styles.priceRow}>
          <span className={styles.price}>{formatUsdFromCents(price)}</span>
          <span className={styles.priceSuffix}>/ month</span>
        </p>
        <p className={styles.caption}>{displayPriceCaption(plan, interval)}</p>
        <dl className={styles.meta}>
          <div>
            <dt>Plan</dt>
            <dd>{planId}</dd>
          </div>
          <div>
            <dt>Billing</dt>
            <dd>{interval}</dd>
          </div>
        </dl>
      </section>

      <div className={styles.actions}>
        <button
          type="button"
          className={styles.primaryButton}
          aria-label="Continue to payment"
          disabled={pending}
          onClick={() => void handleContinueToPayment()}
        >
          {pending ? "Starting checkout…" : "Continue to payment"}
        </button>
        <Link href="/sign-up" className={shared.secondaryButton}>
          Create account first
        </Link>
      </div>

      {message ? (
        <p className={styles.info} role="status">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
