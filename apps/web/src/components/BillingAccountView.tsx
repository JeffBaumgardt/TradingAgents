/**
 * @file apps/web/src/components/BillingAccountView.tsx
 * Presentational subscription + usage profile (data provided by parent).
 */

import Link from "next/link";
import type { BillingAccountResponse } from "@tradingagents/api-types";
import { getBillingPlan } from "@tradingagents/api-types";
import ProviderCostBadge from "@/components/ProviderCostBadge";
import {
  costSourceHint,
  formatBillableUnits,
  formatPeriodEnd,
  formatTokenCount,
} from "@/lib/billing-display";
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
            {isHosted ? " — hosted allowance resets then." : "."}
          </p>
        ) : null}
      </section>

      {isHosted && usage ? (
        <>
          <section className={styles.usageCard} aria-labelledby="usage-heading">
            <div className={styles.usageHeader}>
              <h2 id="usage-heading" className={styles.sectionTitle}>
                Hosted allowance
              </h2>
              <p className={styles.periodChip}>
                Resets {formatPeriodEnd(usage.periodEnd)}
              </p>
            </div>
            {usage.isSample ? (
              <p className={styles.sampleNote} role="note">
                Sample usage for review — live token metering ships with the cost matrix. Allowance
                is provisional and intentionally open.
              </p>
            ) : null}
            <div className={styles.progressMeta}>
              <span>
                {formatBillableUnits(usage.usedBillableUnits)} /{" "}
                {formatBillableUnits(usage.allowanceBillableUnits)} billable units
              </span>
              <span>{Math.round(usage.usedRatio * 100)}% used</span>
            </div>
            <div
              className={styles.progressTrack}
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(usage.usedRatio * 100)}
              aria-label="Hosted billable unit usage"
            >
              <div
                className={styles.progressFill}
                style={{ width: `${Math.max(2, usage.usedRatio * 100)}%` }}
              />
            </div>
            <p className={styles.usageFoot}>
              {formatTokenCount(usage.hostedTokens)} hosted tokens counted ·{" "}
              {formatTokenCount(usage.selfPayTokens)} tokens on your keys (excluded from allowance)
            </p>
          </section>

          <section className={styles.breakdownCard} aria-labelledby="breakdown-heading">
            <h2 id="breakdown-heading" className={styles.sectionTitle}>
              Usage at a glance
            </h2>
            <p className={styles.breakdownIntro}>
              Bars show <strong>billable units</strong> (normalized, high-tilt toward expensive
              models). “Your key” traffic still appears for activity, but does not fill the
              allowance bar.
            </p>

            <div className={styles.splitLegend} aria-hidden="true">
              <span className={styles.legendHosted}>Hosted</span>
              <span className={styles.legendSelf}>Your key</span>
            </div>

            <ul className={styles.modelList}>
              {usage.byModel.map((row) => {
                const widthPct = Math.max(
                  row.billableUnits > 0 ? row.shareOfBillable * 100 : 0,
                  row.tokensTotal > 0 && row.billableUnits === 0 ? 8 : 0,
                );
                return (
                  <li key={`${row.providerId}-${row.modelId}`} className={styles.modelRow}>
                    <div className={styles.modelMeta}>
                      <div className={styles.modelTitleRow}>
                        <strong>
                          {row.providerLabel} · {row.modelId}
                        </strong>
                        <ProviderCostBadge source={row.costSource} />
                      </div>
                      <p className={styles.modelStats}>
                        {formatTokenCount(row.tokensTotal)} tokens
                        {row.billableUnits > 0
                          ? ` · ${formatBillableUnits(row.billableUnits)} billable`
                          : " · excluded from allowance"}
                      </p>
                    </div>
                    <div className={styles.barTrack} title={costSourceHint(row.costSource)}>
                      <div
                        className={
                          row.costSource === "hosted" ? styles.barHosted : styles.barSelf
                        }
                        style={{ width: `${widthPct}%` }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>

            <h3 className={styles.subheading}>By provider</h3>
            <ul className={styles.providerList}>
              {usage.byProvider.map((row) => (
                <li key={row.providerId} className={styles.providerRow}>
                  <div>
                    <strong>{row.providerLabel}</strong>
                    <p className={styles.modelStats}>
                      Hosted {formatTokenCount(row.hostedTokens)} · Your key{" "}
                      {formatTokenCount(row.selfPayTokens)}
                    </p>
                  </div>
                  <span className={styles.providerBillable}>
                    {formatBillableUnits(row.billableUnits)} units
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </>
      ) : (
        <section className={styles.usageCard}>
          <h2 className={styles.sectionTitle}>Hosted allowance</h2>
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
          <ProviderCostBadge source="self_pay" /> and never consume your allowance. Providers
          without your key run as <ProviderCostBadge source="hosted" />.
        </p>
        <Link href="/settings/credentials" className={styles.secondaryButton}>
          Manage API keys
        </Link>
      </section>
    </div>
  );
}
