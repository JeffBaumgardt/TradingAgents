/**
 * @file apps/web/src/components/BillingAccountView.tsx
 * Presentational subscription + usage profile (data provided by parent).
 */

import Link from "next/link";
import type { BillingAccountResponse } from "@tradingagents/api-types";
import {
  COMPUTE_CREDIT_REFERENCE_OUTPUT_USD_PER_1M,
  HOSTED_MODEL_CATALOG_PRICED_AS_OF,
  getBillingPlan,
} from "@tradingagents/api-types";
import ProviderCostBadge from "@/components/ProviderCostBadge";
import UsageProviderTree from "@/components/UsageProviderTree";
import { formatComputeCredits, formatPeriodEnd, formatTokenCount } from "@/lib/billing-display";
import { formatUsdFromCents } from "@/lib/pricing-content";
import styles from "./BillingPageContent.module.css";

interface BillingAccountViewProps {
  account: BillingAccountResponse;
  previewBanner?: string;
}

export default function BillingAccountView({
  account,
  previewBanner,
}: BillingAccountViewProps) {
  const { subscription, usage } = account;
  const plan =
    subscription.planId && subscription.status === "active"
      ? getBillingPlan(subscription.planId)
      : null;
  const isHosted = plan?.id === "hosted";

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
              {plan ? plan.name : "No active subscription"}
            </h2>
            <p className={styles.planMeta}>
              {plan
                ? `${formatUsdFromCents(plan.monthlyPriceCents)}/mo · billed ${subscription.interval ?? "monthly"}`
                : "Start with Bring your own key for infrastructure, or Hosted models for a wide catalog."}
            </p>
          </div>
          <div className={styles.planActions}>
            {isHosted ? (
              <Link href="/pricing" className={styles.secondaryButton}>
                View plans
              </Link>
            ) : (
              <Link
                href="/checkout?plan=hosted&interval=monthly"
                className={styles.primaryButton}
                aria-label="Upgrade to hosted models"
              >
                Upgrade to Hosted
              </Link>
            )}
            {!plan ? (
              <Link
                href="/checkout?plan=byok&interval=monthly"
                className={styles.secondaryButton}
              >
                Start BYOK plan
              </Link>
            ) : null}
          </div>
        </div>
        {subscription.currentPeriodEnd ? (
          <p className={styles.periodNote}>
            Current billing period ends{" "}
            <strong>{formatPeriodEnd(subscription.currentPeriodEnd)}</strong>
            {isHosted ? " — compute credit allowance resets then." : "."}
          </p>
        ) : null}
      </section>

      {isHosted && usage ? (
        <>
          <section className={styles.usageCard} aria-labelledby="usage-heading">
            <div className={styles.usageHeader}>
              <h2 id="usage-heading" className={styles.sectionTitle}>
                Compute credit allowance
              </h2>
              <p className={styles.periodChip}>
                Resets {formatPeriodEnd(usage.periodEnd)}
              </p>
            </div>
            {usage.isSample ? (
              <p className={styles.sampleNote} role="note">
                Sample usage for review — live metering will use the curated cost catalog. Hosted
                plans include {formatComputeCredits(usage.allowanceComputeCredits)} compute credits
                per month.
              </p>
            ) : null}
            <div className={styles.progressMeta}>
              <span>
                {formatComputeCredits(usage.usedComputeCredits)} /{" "}
                {formatComputeCredits(usage.allowanceComputeCredits)} compute credits
              </span>
              <span>{Math.round(usage.usedRatio * 100)}% used</span>
            </div>
            <div
              className={styles.progressTrack}
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(usage.usedRatio * 100)}
              aria-label="Hosted compute credit usage"
            >
              <div
                className={styles.progressFill}
                style={{ width: `${Math.max(2, usage.usedRatio * 100)}%` }}
              />
            </div>
          </section>

          <section className={styles.breakdownCard} aria-labelledby="breakdown-heading">
            <h2 id="breakdown-heading" className={styles.sectionTitle}>
              Usage by provider
            </h2>
            <p className={styles.breakdownIntro}>
              Expand a provider to see models. Each model shows its{" "}
              <strong>credit multiplier</strong> (from API output $/1M tokens) plus raw tokens and
              compute credits.
            </p>

            <UsageProviderTree byProvider={usage.byProvider} byModel={usage.byModel} />
          </section>

          <section className={styles.helpCard} aria-labelledby="credits-help-heading">
            <h2 id="credits-help-heading" className={styles.sectionTitle}>
              What are compute credits?
            </h2>
            <p className={styles.breakdownIntro}>
              Hosted runs spend <strong>compute credits</strong>, not raw tokens, against your
              monthly allowance. We normalize by each model’s published{" "}
              <strong>output price per million tokens</strong>, so a cheap model (Haiku, Flash,
              Nano) drains the pool slowly and a frontier reasoning model drains it faster.
            </p>
            <p className={styles.breakdownIntro}>
              {`Reference model: DeepSeek V4 Flash at $${COMPUTE_CREDIT_REFERENCE_OUTPUT_USD_PER_1M}/1M output tokens = `}
              <strong>×1</strong>. Catalog prices reviewed {HOSTED_MODEL_CATALOG_PRICED_AS_OF}.
              “Your key” traffic still appears in the tree but never consumes credits.
            </p>
          </section>
        </>
      ) : (
        <section className={styles.usageCard}>
          <h2 className={styles.sectionTitle}>Compute credit allowance</h2>
          <p className={styles.breakdownIntro}>
            Usage tracking applies on the Hosted models plan. Bring your own key keeps model spend
            on your provider account; we only charge the platform fee.
          </p>
          <Link
            href="/checkout?plan=hosted&interval=monthly"
            className={styles.primaryButton}
          >
            See Hosted plan
          </Link>
        </section>
      )}

      <section className={styles.helpCard}>
        <h2 className={styles.sectionTitle}>Keys on Hosted</h2>
        <p className={styles.breakdownIntro}>
          On Hosted you can still save personal API keys. Those providers show as{" "}
          <ProviderCostBadge source="self_pay" /> and never consume compute credits. Providers
          without your key run as <ProviderCostBadge source="hosted" />.
        </p>
        <Link href="/settings/credentials" className={styles.secondaryButton}>
          Manage API keys
        </Link>
      </section>
    </div>
  );
}
