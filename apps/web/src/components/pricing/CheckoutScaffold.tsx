/**
 * @file apps/web/src/components/pricing/CheckoutScaffold.tsx
 * Free trial first (no card), optional Stripe pay for conversion.
 */

"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { useState } from "react";
import {
  createCheckoutSession,
  startBillingTrial,
  ApiClientError,
} from "@/lib/api-client";
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
  TRIAL_DAYS,
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
    return { ok: true, planId: "pro", interval: "monthly" };
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
    planId: isPricingPlanId(planParam) ? planParam : "pro",
    interval: isBillingInterval(intervalParam) ? intervalParam : "monthly",
  };
}

export default function CheckoutScaffold() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isLoaded, isSignedIn } = useAuth();
  const [pendingStripe, setPendingStripe] = useState(false);
  const [pendingTrial, setPendingTrial] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [subscriptionActivated, setSubscriptionActivated] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selection = resolveCheckoutSelection(
    searchParams.get("plan"),
    searchParams.get("interval"),
  );

  async function handleStartTrial(planId: BillingPlanId) {
    setPendingTrial(true);
    setError(null);
    setMessage(null);
    setSubscriptionActivated(false);

    try {
      await startBillingTrial(planId);
      router.push("/dashboard?checkout=1");
    } catch (caught) {
      if (caught instanceof ApiClientError) {
        setError(caught.message);
      } else {
        setError("Could not start your free trial. Please try again.");
      }
    } finally {
      setPendingTrial(false);
    }
  }

  async function handlePayWithStripe(planId: BillingPlanId, interval: BillingInterval) {
    setPendingStripe(true);
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

      setSubscriptionActivated(Boolean(result.subscriptionActivated));
      setMessage(
        result.subscriptionActivated
          ? "Stripe isn’t connected yet, so we activated a temporary review subscription (BILLING_SCAFFOLD). Connect STRIPE_SECRET_KEY on the API to take real payments."
          : (result.message ??
            "Stripe isn’t connected yet. Add STRIPE_SECRET_KEY and price IDs on the API, or set BILLING_SCAFFOLD=true for local review."),
      );
    } catch (caught) {
      if (caught instanceof ApiClientError) {
        setError(caught.message);
      } else {
        setError("Could not start Stripe Checkout. Please try again later.");
      }
    } finally {
      setPendingStripe(false);
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
  const priceLabel = formatUsdFromCents(price);
  const signUpHref = buildCheckoutSignUpHref(planId, interval);
  const signInHref = buildCheckoutSignInHref(planId, interval);
  const busy = pendingStripe || pendingTrial;
  const trialLabel = pendingTrial
    ? "Starting free trial…"
    : `Start free ${TRIAL_DAYS}-day trial`;
  const payLabel = pendingStripe
    ? "Opening Stripe Checkout…"
    : `Subscribe now — ${priceLabel}/mo`;

  const stepLabel = !isLoaded
    ? "Loading…"
    : isSignedIn
      ? "Step 2 of 2 — Start free or subscribe"
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
              ? `Start your free ${TRIAL_DAYS}-day trial`
              : "Create your free account"}
        </h1>
        <p className={styles.intro}>
          {!isLoaded
            ? "Loading your session…"
            : isSignedIn
              ? `No credit card needed for the trial. When the ${TRIAL_DAYS} days end, subscribe with Stripe to keep running analyses on the ${plan.name} plan.`
              : `No credit card needed. Create an account to begin a ${TRIAL_DAYS}-day free trial of ${plan.name}, then return here if you prefer to subscribe right away.`}
        </p>
      </header>

      <section className={styles.summary} aria-labelledby="checkout-summary-heading">
        <div className={styles.summaryTop}>
          <p className={styles.trialBadge}>
            {TRIAL_DAYS}-day free trial · No credit card needed
          </p>
          <div className={styles.planHeading}>
            <h2 id="checkout-summary-heading" className={styles.summaryTitle}>
              {plan.name}
              {plan.priceProvisional ? (
                <span className={pricingStyles.provisional}>Provisional</span>
              ) : null}
            </h2>
            {plan.recommended ? (
              <span className={styles.recommendedChip}>Recommended</span>
            ) : null}
          </div>
          <p className={styles.summaryTagline}>{plan.tagline}</p>
        </div>

        <div className={styles.pricingBlock}>
          <div className={styles.todayRow}>
            <span className={styles.todayLabel}>Today</span>
            <span className={styles.todayValue}>Free for {TRIAL_DAYS} days</span>
          </div>
          <div className={styles.thenRow}>
            <span className={styles.thenLabel}>Then</span>
            <p className={styles.priceRow}>
              <span className={styles.price}>{priceLabel}</span>
              <span className={styles.priceSuffix}>/ month</span>
            </p>
          </div>
          <p className={styles.caption}>{displayPriceCaption(plan, interval)}</p>
        </div>

        <ul className={styles.highlightList} aria-label={`${plan.name} plan includes`}>
          {plan.highlights.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>

        <p className={styles.finePrint}>
          Trial uses real compute credits against the {plan.name} allowance. Cancel anytime before
          the trial ends — you only pay if you subscribe.
        </p>
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
          <>
            <button
              type="button"
              className={styles.primaryButton}
              aria-label={trialLabel}
              disabled={busy}
              onClick={() => void handleStartTrial(planId)}
            >
              {trialLabel}
            </button>
            <button
              type="button"
              className={styles.secondaryButton}
              aria-label={payLabel}
              disabled={busy}
              onClick={() => void handlePayWithStripe(planId, interval)}
            >
              {payLabel}
            </button>
          </>
        ) : (
          <>
            <Link
              href={signUpHref}
              className={styles.primaryButton}
              aria-label="Create free account to start trial"
            >
              Create free account
            </Link>
            <Link
              href={signInHref}
              className={styles.secondaryButton}
              aria-label="Sign in to continue"
            >
              Sign in
            </Link>
          </>
        )}
      </div>

      {isSignedIn ? (
        <p className={styles.actionsHint}>
          Prefer to skip the trial? Subscribe now routes you to secure Stripe Checkout.
        </p>
      ) : (
        <p className={styles.actionsHint}>
          After you sign up, you can start the free trial without a card.
        </p>
      )}

      {message ? (
        <div className={styles.info} role="status">
          <p>{message}</p>
          {subscriptionActivated ? (
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
