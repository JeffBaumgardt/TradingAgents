/**
 * @file apps/web/src/components/HostedModelCostGuide.tsx
 * Agents Model credit explainer: one number that covers input and output.
 */

import {
  AGENTS_MODEL_DISPLAY_NAME,
  HOSTED_MODEL_CATALOG_PRICED_AS_OF,
  PRO_MONTHLY_COMPUTE_CREDIT_ALLOWANCE,
  PRO_MONTHLY_OUTPUT_TOKEN_EQUIVALENT,
  STANDARD_MONTHLY_COMPUTE_CREDIT_ALLOWANCE,
} from "@tradingagents/api-types";
import { formatComputeCredits } from "@/lib/billing-display";
import styles from "./BillingPageContent.module.css";

export default function HostedModelCostGuide() {
  return (
    <section className={styles.breakdownCard} aria-labelledby="cost-guide-heading">
      <h2 id="cost-guide-heading" className={styles.sectionTitle}>
        How credits work
      </h2>
      <p className={styles.breakdownIntro}>
        Every {AGENTS_MODEL_DISPLAY_NAME} run spends compute credits. Input and output are
        combined into one balance so you do not have to track token types separately. Pro
        includes {formatComputeCredits(PRO_MONTHLY_COMPUTE_CREDIT_ALLOWANCE)} credits per month
        — about {formatComputeCredits(PRO_MONTHLY_OUTPUT_TOKEN_EQUIVALENT)} of output. Standard
        includes {formatComputeCredits(STANDARD_MONTHLY_COMPUTE_CREDIT_ALLOWANCE)} (one-third of
        Pro). Deeper research and higher efficiency quality use more credits.
      </p>
      <p className={styles.mutedNote}>
        Catalog prices reviewed {HOSTED_MODEL_CATALOG_PRICED_AS_OF}.
      </p>
    </section>
  );
}
