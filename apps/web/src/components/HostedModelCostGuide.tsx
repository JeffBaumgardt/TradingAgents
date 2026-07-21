/**
 * @file apps/web/src/components/HostedModelCostGuide.tsx
 * Hosted catalog spend guide: multiplier, 💵 tier, and estimated runs / month.
 */

import {
  HOSTED_MODEL_CATALOG_PRICED_AS_OF,
  HOSTED_MONTHLY_COMPUTE_CREDIT_ALLOWANCE,
  listHostedModelCatalog,
} from "@tradingagents/api-types";
import {
  TYPICAL_HOSTED_ANALYSIS_TOKENS,
  creditSpendTierFromMultiplier,
  creditSpendTierLabel,
  estimateTypicalRunsPerMonth,
  formatComputeCredits,
  formatCreditMultiplier,
  formatCreditSpendDollars,
  formatTokenCount,
} from "@/lib/billing-display";
import styles from "./BillingPageContent.module.css";

export default function HostedModelCostGuide() {
  const catalog = listHostedModelCatalog();
  const rows = [...catalog.models].sort(
    (a, b) => a.creditMultiplier - b.creditMultiplier || a.displayName.localeCompare(b.displayName),
  );

  return (
    <section className={styles.breakdownCard} aria-labelledby="cost-guide-heading">
      <h2 id="cost-guide-heading" className={styles.sectionTitle}>
        Model spend guide
      </h2>
      <p className={styles.breakdownIntro}>
        Estimates assume a typical depth-1 analysis (~
        {formatTokenCount(TYPICAL_HOSTED_ANALYSIS_TOKENS)} tokens) against your{" "}
        {formatComputeCredits(HOSTED_MONTHLY_COMPUTE_CREDIT_ALLOWANCE)} monthly compute credit
        allowance. Spend scale: <span aria-label="one dollar">💵</span> budget →{" "}
        <span aria-label="five dollars">💵💵💵💵💵</span> frontier. Exact credit burn still uses
        the × multiplier on real token usage; longer or deeper runs cost more.
      </p>

      <div className={styles.costGuideScroll}>
        <table className={styles.costGuideTable}>
          <caption className={styles.visuallyHidden}>
            Hosted model credit multipliers, spend tiers, and estimated analyses per month
          </caption>
          <thead>
            <tr>
              <th scope="col">Model</th>
              <th scope="col">Spend</th>
              <th scope="col">Multiplier</th>
              <th scope="col">Est. runs / mo</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((model) => {
              const tier = creditSpendTierFromMultiplier(model.creditMultiplier);
              const dollars = formatCreditSpendDollars(model.creditMultiplier);
              const runs = estimateTypicalRunsPerMonth(model.creditMultiplier);
              return (
                <tr key={`${model.providerId}-${model.modelId}`}>
                  <th scope="row">
                    <span className={styles.costGuideModelName}>{model.displayName}</span>
                    <span className={styles.costGuideModelMeta}>
                      {model.providerLabel} · {model.modelId}
                    </span>
                  </th>
                  <td>
                    <span
                      className={styles.spendDollars}
                      title={`${creditSpendTierLabel(tier)} spend · ${formatCreditMultiplier(model.creditMultiplier)}`}
                      aria-label={`${creditSpendTierLabel(tier)} spend, ${tier} of 5`}
                    >
                      {dollars}
                    </span>
                  </td>
                  <td>
                    <span className={styles.multiplierChip}>
                      {formatCreditMultiplier(model.creditMultiplier)}
                    </span>
                  </td>
                  <td className={styles.costGuideRuns}>~{formatTokenCount(runs)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className={styles.usageFoot}>
        Catalog prices reviewed {HOSTED_MODEL_CATALOG_PRICED_AS_OF}. Reasoning models often use
        more tokens than this baseline, so treat frontier estimates as optimistic.
      </p>
    </section>
  );
}
