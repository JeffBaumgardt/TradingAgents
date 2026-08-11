/**
 * @file apps/web/src/components/HostedModelCostGuide.tsx
 * Agents Model spend guide: multiplier, 💵 tier, and estimated runs / month.
 */

import {
  AGENTS_MODEL_DISPLAY_NAME,
  HOSTED_MODEL_CATALOG_PRICED_AS_OF,
  PRO_MONTHLY_COMPUTE_CREDIT_ALLOWANCE,
  listHostedModelCatalog,
} from "@tradingagents/api-types";
import {
  TYPICAL_AGENTS_ANALYSIS_TOKENS,
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
        Agents Model spend guide
      </h2>
      <p className={styles.breakdownIntro}>
        Estimates assume a typical depth-1 analysis (~
        {formatTokenCount(TYPICAL_AGENTS_ANALYSIS_TOKENS)} tokens) against a{" "}
        {formatComputeCredits(PRO_MONTHLY_COMPUTE_CREDIT_ALLOWANCE)} Pro monthly compute credit
        allowance. Spend scale: <span aria-label="one dollar">💵</span> budget →{" "}
        <span aria-label="five dollars">💵💵💵💵💵</span> frontier. Exact credit burn still uses
        the × multiplier on real token usage; longer or deeper runs cost more.
      </p>

      <div className={styles.costGuideScroll}>
        <table className={styles.costGuideTable}>
          <caption className={styles.visuallyHidden}>
            {AGENTS_MODEL_DISPLAY_NAME} credit multipliers, spend tiers, and estimated analyses per
            month
          </caption>
          <thead>
            <tr>
              <th scope="col">Model</th>
              <th scope="col">Provider</th>
              <th scope="col">× credits</th>
              <th scope="col">Spend</th>
              <th scope="col">~Analyses / mo</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((model) => {
              const tier = creditSpendTierFromMultiplier(model.creditMultiplier);
              return (
                <tr key={`${model.providerId}:${model.modelId}`}>
                  <th scope="row">{model.displayName}</th>
                  <td>{model.providerId}</td>
                  <td>{formatCreditMultiplier(model.creditMultiplier)}</td>
                  <td title={creditSpendTierLabel(tier)}>
                    <span aria-label={creditSpendTierLabel(tier)}>
                      {formatCreditSpendDollars(model.creditMultiplier)}
                    </span>
                  </td>
                  <td>
                    {formatTokenCount(estimateTypicalRunsPerMonth(model.creditMultiplier))}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className={styles.mutedNote}>
        Catalog prices reviewed {HOSTED_MODEL_CATALOG_PRICED_AS_OF}. Reasoning settings (efficiency)
        often use more tokens than the typical depth-1 baseline.
      </p>
    </section>
  );
}
