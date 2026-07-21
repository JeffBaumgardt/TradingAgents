/**
 * @file apps/web/src/components/pricing/CheckoutScaffold.tsx
 * Single checkout path: Clerk account first, then payment setup.
 */

"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { useState } from "react";
import { createCheckoutSession, ApiClientError } from "@/lib/api-client";
import {
  buildCheckoutSignInHref,
  buildCheckoutSignUpHref,
} from "@/lib/checkout-redirect";
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
import pricingStyles from "./PricingLayout.module.css";
import styles from "./CheckoutScaffold.module.css";

function resolveCheckoutSelection(
  planParam: string | null,
  intervalParam: string | null,
):
  | { ok: true; planId: BillingPlanId; interval: BillingInterval }
  | { ok: false; reason: string } {
  const planMissing = planParam === null || planParam === "";
  const intervalMissing = intervalParam === null || intervalParam === "";

  if (planMissing && intervalMissing) {
    return { ok: true, planId: "byok", interval: "monthly" };
  }

  if (!planMissing && !isPricingPlanId(planParam)) {
    return {
      ok: false,
      reason: `Unknown plan “${planParam}”. Choose a plan from the pricing page.`,
    };
  }

  if (!intervalMissing && !isBillingInterval(intervalParam)) {
    return {
      ok: false,
      reason: `Unknown billing interval “${intervalParam}”. Use monthly or annual.`,
    };
  }

  return {
    ok: true,
    planId: isPricingPlanId(planParam) ? planParam : "byok",
    interval: isBillingInterval(intervalParam) ? intervalParam : "monthly",
  };
}

export default function CheckoutScaffold() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isLoaded, isSignedIn } = useAuth();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [subscriptionActivated, setSubscriptionActivated] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selection = resolveCheckoutSelection(
    searchParams.get("plan"),
    searchParams.get("interval"),
  );

  async function handleContinueToPayment(planId: BillingPlanId, interval: BillingInterval) {
    setPending(true);
    setError(null);
    setMessage(null);
    setSubscriptionActivated(false);

    try {
      const result = await createCheckoutSession({
        planId,
        interval,
      });
      setSubscriptionActivated(Boolean(result.subscriptionActivated));
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

  function handleContinue(planId: BillingPlanId, interval: BillingInterval) {
    if (!isSignedIn) {
      router.push(buildCheckoutSignUpHref(planId, interval));
      return;
    }
    void handleContinueToPayment(planId, interval);
  }

  if (!selection.ok) {
    return (
      <div className={styles.page}>
        <Link href="/pricing" className={styles.backLink}>
          ← Back to pricing
        </Link>

        <header className={styles.header}>
          <p className={pricingStyles.eyebrow}>Checkout</p>
          <h1 className={styles.title}>Invalid checkout link</h1>
          <p className={styles.intro}>
            This checkout URL has an invalid plan or billing interval. Return to pricing and
            pick a plan again.
          </p>
        </header>

        <p className={styles.error} role="alert">
          {selection.reason}
        </p>

        <div className={styles.actions}>
          <Link href="/pricing" className={pricingStyles.primaryButton} aria-label="View pricing">
            View pricing
          </Link>
        </div>
      </div>
    );
  }

  const { planId, interval } = selection;
  const plan = getPricingPlan(planId);
  const price = displayPriceCents(plan, interval);
  const stepLabel = !isLoaded
    ? "Loading…"
    : isSignedIn
      ? "Step 2 of 2 — Payment"
      : "Step 1 of 2 — Create your account";
  const ctaLabel = !isLoaded
    ? "Loading…"
    : isSignedIn
      ? pending
        ? "Starting payment…"
        : "Continue to payment"
      : "Continue to create account";

  return (
    <div className={styles.page}>
      <Link href="/pricing" className={styles.backLink}>
        ← Back to pricing
      </Link>

      <header className={styles.header}>
        <p className={pricingStyles.eyebrow}>Checkout · {stepLabel}</p>
        <h1 className={styles.title}>
          {isSignedIn ? "Set up payment" : "Create your account to continue"}
        </h1>
        <p className={styles.intro}>
          {isSignedIn
            ? "Your account is ready. Continue to payment setup. Stripe is not live yet — this step activates a scaffold subscription so you can use the app."
            : "One path: create your TradingAgents account with Clerk, then you’ll return here to finish payment for the plan below."}
        </p>
      </header>

      <section className={styles.summary} aria-labelledby="checkout-summary-heading">
        <h2 id="checkout-summary-heading" className={styles.summaryTitle}>
          {plan.name}
          {plan.priceProvisional ? (
            <span className={pricingStyles.provisional}>Provisional</span>
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
          aria-label={ctaLabel}
          disabled={!isLoaded || pending}
          onClick={() => handleContinue(planId, interval)}
        >
          {ctaLabel}
        </button>
      </div>

      {!isSignedIn && isLoaded ? (
        <p className={styles.caption}>
          Already have an account?{" "}
          <Link href={buildCheckoutSignInHref(planId, interval)}>Sign in</Link>
          , then you’ll continue to payment.
        </p>
      ) : null}

      {message ? (
        <div className={styles.info} role="status">
          <p>{message}</p>
          {subscriptionActivated ? (
            <p>
              <Link href="/dashboard">Go to dashboard →</Link>
              {" · "}
              <Link href="/settings/billing">Billing & usage</Link>
            </p>
          ) : null}
        </div>
      ) : null}
      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
