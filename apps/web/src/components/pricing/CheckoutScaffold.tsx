/**
 * @file apps/web/src/components/pricing/CheckoutScaffold.tsx
 * Clerk account first, then Stripe Managed Payments Checkout.
 */

"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
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

  async function handlePayWithStripe(planId: BillingPlanId, interval: BillingInterval) {
    setPending(true);
    setError(null);
    setMessage(null);
    setSubscriptionActivated(false);

    try {
      const result = await createCheckoutSession({
        planId,
        interval,
      });

      if (result.status === "ready" && result.checkoutUrl) {
        window.location.assign(result.checkoutUrl);
        return;
      }

      // Stripe env not configured on the API — surface that clearly.
      setSubscriptionActivated(Boolean(result.subscriptionActivated));
      setMessage(
        result.subscriptionActivated
          ? "Stripe isn’t connected yet, so we activated a temporary review subscription. Connect STRIPE_SECRET_KEY on the API to take real payments."
          : (result.message ??
            "Stripe isn’t connected yet. Add STRIPE_SECRET_KEY and price IDs on the API, then try again."),
      );
    } catch (caught) {
      if (caught instanceof ApiClientError) {
        setError(caught.message);
      } else {
        setError("Could not start Stripe Checkout. Please try again later.");
      }
    } finally {
      setPending(false);
    }
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
          <Link href="/pricing" className={styles.primaryButton} aria-label="View pricing">
            View pricing
          </Link>
        </div>
      </div>
    );
  }

  const { planId, interval } = selection;
  const plan = getPricingPlan(planId);
  const price = displayPriceCents(plan, interval);
  const signUpHref = buildCheckoutSignUpHref(planId, interval);
  const signInHref = buildCheckoutSignInHref(planId, interval);
  const payLabel = pending
    ? "Opening Stripe Checkout…"
    : `Subscribe — ${formatUsdFromCents(price)}/mo`;

  const stepLabel = !isLoaded
    ? "Loading…"
    : isSignedIn
      ? "Step 2 of 2 — Payment"
      : "Step 1 of 2 — Create your account";

  return (
    <div className={styles.page}>
      <Link href="/pricing" className={styles.backLink}>
        ← Back to pricing
      </Link>

      <header className={styles.header}>
        <p className={pricingStyles.eyebrow}>Checkout · {stepLabel}</p>
        <h1 className={styles.title}>
          {!isLoaded
            ? "Checkout"
            : isSignedIn
              ? "Pay with Stripe"
              : "Create your account to continue"}
        </h1>
        <p className={styles.intro}>
          {!isLoaded
            ? "Loading your session…"
            : isSignedIn
              ? "You’ll complete payment on Stripe’s secure checkout. Tax is calculated from the billing address you enter there."
              : "Create a TradingAgents account, then you’ll return here to pay for the plan below with Stripe."}
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
        {!isLoaded ? (
          <button
            type="button"
            className={styles.primaryButton}
            aria-label="Loading checkout"
            disabled
          >
            Loading…
          </button>
        ) : isSignedIn ? (
          <button
            type="button"
            className={styles.primaryButton}
            aria-label={payLabel}
            disabled={pending}
            onClick={() => void handlePayWithStripe(planId, interval)}
          >
            {payLabel}
          </button>
        ) : (
          <>
            <Link
              href={signUpHref}
              className={styles.primaryButton}
              aria-label="Create account to continue to payment"
            >
              Create account
            </Link>
            <Link
              href={signInHref}
              className={styles.secondaryButton}
              aria-label="Sign in to continue to payment"
            >
              Sign in
            </Link>
          </>
        )}
      </div>

      {message ? (
        <div className={styles.info} role="status">
          <p>{message}</p>
          {subscriptionActivated ? (
            <div className={styles.actions}>
              <Link
                href="/dashboard"
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
