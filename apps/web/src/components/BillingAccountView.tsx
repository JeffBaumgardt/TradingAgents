/**
 * @file apps/web/src/components/BillingAccountView.tsx
 * Presentational subscription + usage profile (data provided by parent).
 */

"use client";

import Link from "next/link";
import { useState } from "react";
import type { BillingAccountResponse } from "@tradingagents/api-types";
import {
  AGENTS_MODEL_DISPLAY_NAME,
  AGENTS_MODEL_ID,
  COMPUTE_CREDIT_REFERENCE_OUTPUT_USD_PER_1M,
  getBillingPlan,
} from "@tradingagents/api-types";
import CancelSubscriptionDialog from "@/components/CancelSubscriptionDialog";
import { ApiClientError, cancelSubscription } from "@/lib/api-client";
import { formatComputeCredits, formatPeriodEnd, formatTokenCount } from "@/lib/billing-display";
import { formatUsdFromCents } from "@/lib/pricing-content";
import styles from "./BillingPageContent.module.css";

interface BillingAccountViewProps {
  account: BillingAccountResponse;
  previewBanner?: string;
  /** When set, cancel updates live account state after a successful API call. */
  onAccountChange?: (account: BillingAccountResponse) => void;
}

export default function BillingAccountView({
  account,
  previewBanner,
  onAccountChange,
}: BillingAccountViewProps) {
  const { subscription, usage, features, agentsModelDisplayName } = account;
  const plan =
    subscription.planId &&
    (subscription.status === "active" ||
      subscription.status === "trialing" ||
      subscription.status === "past_due")
      ? getBillingPlan(subscription.planId)
      : null;
  const isPro = plan?.id === "pro";
  const isTrial = subscription.status === "trialing" || Boolean(subscription.isTrial);
  const canCancel =
    Boolean(onAccountChange) &&
    Boolean(plan) &&
    (subscription.status === "active" ||
      subscription.status === "past_due" ||
      subscription.status === "trialing") &&
    !subscription.cancelAtPeriodEnd;

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  async function handleConfirmCancel() {
    if (!onAccountChange) {
      return;
    }

    setSubmitting(true);
    setCancelError(null);
    try {
      const result = await cancelSubscription();
      onAccountChange({
        ...account,
        subscription: result.subscription,
      });
      setConfirmOpen(false);
    } catch (caught) {
      setCancelError(
        caught instanceof ApiClientError
          ? caught.message
          : "Could not cancel subscription. Try again.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  function handleOpenCancel() {
    setCancelError(null);
    setConfirmOpen(true);
  }

  function handleCloseCancel() {
    if (submitting) {
      return;
    }
    setConfirmOpen(false);
    setCancelError(null);
  }

  const modelName = agentsModelDisplayName ?? AGENTS_MODEL_DISPLAY_NAME;
  const planFeatures = features ?? {
    shareReports: isPro,
    reportRetentionDays: null,
  };

  return (
    <div className={styles.page}>
      {previewBanner ? (
        <p className={styles.sampleNote} role="note">
          {previewBanner}
        </p>
      ) : null}

      <section className={styles.planCard} aria-labelledby="current-plan-heading">
        <div className={styles.planHeader}>
          <div>
            <p className={styles.eyebrow}>Current plan</p>
            <h2 id="current-plan-heading" className={styles.planTitle}>
              {plan ? plan.name : "No active plan"}
              {isTrial ? " (trial)" : ""}
            </h2>
            <p className={styles.planMeta}>
              {subscription.status === "past_due" && plan
                ? "Payment past due — new analyses are paused until payment succeeds. You can still cancel to stop renewals."
                : subscription.status === "expired"
                  ? "Your free trial has ended. Subscribe to keep running analyses."
                  : plan
                    ? `${formatUsdFromCents(plan.monthlyPriceCents)}/mo · billed ${subscription.interval ?? "monthly"}`
                    : "Start a free 14-day Pro trial (no card), or subscribe to Standard or Pro."}
            </p>
          </div>
          <div className={styles.planActions}>
            {isPro ? (
              <Link href="/pricing" className={styles.secondaryButton}>
                View plans
              </Link>
            ) : (
              <Link
                href="/checkout?plan=pro&interval=monthly"
                className={styles.primaryButton}
                aria-label="Upgrade to Pro"
              >
                Upgrade to Pro
              </Link>
            )}
            {!plan ? (
              <Link
                href="/checkout?plan=standard&interval=monthly"
                className={styles.secondaryButton}
              >
                Subscribe to Standard
              </Link>
            ) : null}
            {canCancel ? (
              <button
                type="button"
                className={styles.dangerButton}
                onClick={handleOpenCancel}
                aria-label="Cancel subscription"
              >
                Cancel {isTrial ? "trial" : "subscription"}
              </button>
            ) : null}
          </div>
        </div>
        {isTrial && subscription.currentPeriodEnd ? (
          <p className={styles.periodNote} role="status">
            Free trial ends{" "}
            <strong>{formatPeriodEnd(subscription.currentPeriodEnd)}</strong>. Credit usage still
            counts during the trial. We’ll ask for a payment method only when you subscribe.
          </p>
        ) : subscription.cancelAtPeriodEnd && subscription.currentPeriodEnd ? (
          <p className={styles.periodNote} role="status">
            Cancellation scheduled. Access continues until{" "}
            <strong>{formatPeriodEnd(subscription.currentPeriodEnd)}</strong>.
          </p>
        ) : subscription.currentPeriodEnd ? (
          <p className={styles.periodNote}>
            Current billing period ends{" "}
            <strong>{formatPeriodEnd(subscription.currentPeriodEnd)}</strong>
            {" — compute credit allowance resets then."}
          </p>
        ) : null}
      </section>

      <section className={styles.planCard} aria-labelledby="agents-model-heading">
        <h2 id="agents-model-heading" className={styles.sectionTitle}>
          Agents Model
        </h2>
        <p className={styles.breakdownIntro}>
          All analyses use <strong>{modelName}</strong> ({AGENTS_MODEL_ID}). There is no provider
          or model picker — compute credits meter solely against this model.
        </p>
        <ul className={styles.breakdownIntro}>
          <li>
            Report sharing:{" "}
            {planFeatures.shareReports ? "enabled (Pro)" : "Pro only — upgrade to share by link"}
          </li>
        </ul>
        {!planFeatures.shareReports ? (
          <p className={styles.sampleNote} role="note">
            Sharing finished reports by link is a Pro feature.{" "}
            <Link href="/checkout?plan=pro&interval=monthly">Upgrade to Pro</Link>
          </p>
        ) : null}
      </section>

      {usage ? (
        <>
          <section className={styles.usageCard} aria-labelledby="usage-heading">
            <div className={styles.usageHeader}>
              <h2 id="usage-heading" className={styles.sectionTitle}>
                Credit usage
              </h2>
              <p className={styles.periodChip}>
                Resets {formatPeriodEnd(usage.periodEnd)}
              </p>
            </div>
            {usage.isSample ? (
              <p className={styles.sampleNote} role="note">
                Sample usage for review — live metering charges{" "}
                {formatComputeCredits(usage.baseAllowanceComputeCredits)} compute credits per month
                on this plan.
              </p>
            ) : null}
            {usage.blockedLowBalance ? (
              <p className={styles.sampleNote} role="alert">
                New runs are blocked for the rest of this billing period because remaining credits
                fell below the low-balance threshold (about 3% of your allowance). Allowance resets{" "}
                {formatPeriodEnd(usage.periodEnd)}.
              </p>
            ) : null}
            <div className={styles.progressMeta}>
              <span>
                {formatComputeCredits(usage.usedComputeCredits)} used of{" "}
                {formatComputeCredits(usage.allowanceComputeCredits)} available
              </span>
              <span>{Math.round(usage.usedRatio * 100)}% of allowance</span>
            </div>
            <p className={styles.breakdownIntro}>
              Remaining: {formatComputeCredits(usage.remainingComputeCredits)} · Tokens recorded:{" "}
              {formatTokenCount(usage.tokensTotal)} · 1 credit ≈ 1 token at Agents Model rate
              (reference ${COMPUTE_CREDIT_REFERENCE_OUTPUT_USD_PER_1M.toFixed(3)}/1M output ×
              model multiplier)
            </p>
            <div
              className={styles.progressTrack}
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(usage.usedRatio * 100)}
              aria-label="Compute credit usage"
            >
              <div
                className={styles.progressFill}
                style={{ width: `${Math.max(2, usage.usedRatio * 100)}%` }}
              />
            </div>
          </section>

          {usage.byModel.length > 0 ? (
            <section className={styles.breakdownCard} aria-labelledby="breakdown-heading">
              <h2 id="breakdown-heading" className={styles.sectionTitle}>
                Usage detail
              </h2>
              <ul className={styles.breakdownIntro}>
                {usage.byModel.map((row) => (
                  <li key={`${row.providerId}-${row.modelId}`}>
                    {row.modelId}: {formatComputeCredits(row.computeCredits)} credits (
                    {formatTokenCount(row.tokensTotal)} tokens, ×{row.creditMultiplier})
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </>
      ) : (
        <section className={styles.usageCard}>
          <h2 className={styles.sectionTitle}>Credit usage</h2>
          <p className={styles.breakdownIntro}>
            Usage appears once you have an active Standard or Pro plan (or trial) and start running
            analyses.
          </p>
          <Link href="/pricing" className={styles.primaryButton}>
            View plans
          </Link>
        </section>
      )}

      <CancelSubscriptionDialog
        open={confirmOpen}
        periodEnd={subscription.currentPeriodEnd}
        pastDue={subscription.status === "past_due"}
        submitting={submitting}
        error={cancelError}
        onClose={handleCloseCancel}
        onConfirm={() => {
          void handleConfirmCancel();
        }}
      />
    </div>
  );
}
