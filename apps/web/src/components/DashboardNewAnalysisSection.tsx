/**
 * @file apps/web/src/components/DashboardNewAnalysisSection.tsx
 * Shows the analysis wizard when subscribed; otherwise a simple resubscribe CTA.
 * Polls briefly after Checkout (`?checkout=1`) so Stripe webhooks can land.
 */

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import CredentialsGate from "@/components/CredentialsGate";
import HomePageSkeleton from "@/components/HomePageSkeleton";
import Wizard from "@/components/Wizard";
import { fetchBillingAccount } from "@/lib/api-client";
import { hasActiveSubscription } from "@/lib/subscription-access";
import styles from "./DashboardNewAnalysisSection.module.css";

interface DashboardNewAnalysisSectionProps {
  /** True when the user already has at least one saved analysis. */
  hasExistingReports: boolean;
  /** True when the recent-sessions fetch failed (do not show empty-state CTA). */
  sessionsLoadError?: boolean;
}

/** ~20s budget covers Stripe webhook latency after Checkout. */
const CHECKOUT_POLL_ATTEMPTS = 20;
const POLL_INTERVAL_MS = 1000;

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export default function DashboardNewAnalysisSection({
  hasExistingReports,
  sessionsLoadError = false,
}: DashboardNewAnalysisSectionProps) {
  const searchParams = useSearchParams();
  const fromCheckout = searchParams.get("checkout") === "1";
  const [subscribed, setSubscribed] = useState<boolean | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [retryToken, setRetryToken] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function loadSubscription() {
      setLoadFailed(false);
      setSubscribed(null);
      const maxAttempts = fromCheckout ? CHECKOUT_POLL_ATTEMPTS : 1;
      let sawSuccessfulResponse = false;

      for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
        try {
          const account = await fetchBillingAccount();
          if (cancelled) {
            return;
          }
          sawSuccessfulResponse = true;
          if (hasActiveSubscription(account.subscription)) {
            setSubscribed(true);
            return;
          }
          if (!fromCheckout || attempt === maxAttempts - 1) {
            setSubscribed(false);
            return;
          }
        } catch {
          if (!fromCheckout) {
            if (!cancelled) {
              setLoadFailed(true);
            }
            return;
          }
        }

        if (attempt < maxAttempts - 1) {
          await wait(POLL_INTERVAL_MS);
        }
      }

      if (cancelled) {
        return;
      }

      if (!sawSuccessfulResponse) {
        setLoadFailed(true);
        return;
      }

      setSubscribed(false);
    }

    void loadSubscription();
    return () => {
      cancelled = true;
    };
  }, [retryToken, fromCheckout]);

  function handleRetry() {
    setRetryToken((token) => token + 1);
  }

  if (loadFailed) {
    return (
      <div className={styles.notice} role="alert" aria-live="polite">
        <p>Could not verify your subscription. Check your connection and try again.</p>
        <button
          type="button"
          className={styles.retryButton}
          onClick={handleRetry}
          aria-label="Retry subscription check"
        >
          Retry
        </button>
      </div>
    );
  }

  if (subscribed === null) {
    return <HomePageSkeleton />;
  }

  if (subscribed) {
    return (
      <CredentialsGate>
        <section aria-labelledby="new-analysis-heading">
          <h2 id="new-analysis-heading" className="pageTitle">
            Start a new analysis
          </h2>
          <p className="muted pageIntro">
            Walk through a short setup to choose a ticker, optional personal context, and which
            AI agents should collaborate. When you are ready, the run page streams live progress
            and finished reports — no refresh needed.
          </p>
          <Wizard />
        </section>
      </CredentialsGate>
    );
  }

  if (hasExistingReports) {
    return (
      <section className={styles.notice} aria-labelledby="resubscribe-heading">
        <h2 id="resubscribe-heading" className={styles.title}>
          Ready for another analysis?
        </h2>
        <p className={styles.copy}>
          Your past reports stay available here. Subscribe again whenever you want to run a new
          one.
        </p>
        <Link href="/pricing" className={styles.primaryLink} aria-label="View subscription plans">
          View plans
        </Link>
      </section>
    );
  }

  if (sessionsLoadError) {
    return (
      <section className={styles.notice} aria-labelledby="resubscribe-heading">
        <h2 id="resubscribe-heading" className={styles.title}>
          Subscribe to run analyses
        </h2>
        <p className={styles.copy}>
          We could not load your recent analyses. You can still pick a plan to start a new one,
          or refresh the page to try loading reports again.
        </p>
        <Link href="/pricing" className={styles.primaryLink} aria-label="View subscription plans">
          View plans
        </Link>
      </section>
    );
  }

  return (
    <section className={styles.empty} aria-labelledby="welcome-back-heading">
      <h1 id="welcome-back-heading" className={styles.emptyTitle}>
        Welcome back
      </h1>
      <p className={styles.emptyCopy}>
        Your previous analyses will show up here once you have run them. To start a new one,
        pick a plan — existing shared links and reports always stay available after you
        subscribe.
      </p>
      <div className={styles.emptyActions}>
        <Link href="/pricing" className={styles.primaryLink} aria-label="Choose a subscription plan">
          Choose a plan
        </Link>
        <Link href="/settings/billing" className={styles.secondaryLink}>
          Billing settings
        </Link>
      </div>
    </section>
  );
}
