/**
 * @file apps/web/src/components/ProviderCostBadge.tsx
 * Compact badge for hosted vs your-key (self-pay) providers.
 */

import type { ProviderCostSource } from "@tradingagents/api-types";
import { costSourceHint, costSourceLabel } from "@/lib/billing-display";
import styles from "./ProviderCostBadge.module.css";

interface ProviderCostBadgeProps {
  source: ProviderCostSource;
}

export default function ProviderCostBadge({ source }: ProviderCostBadgeProps) {
  return (
    <span
      className={source === "hosted" ? styles.hosted : styles.selfPay}
      title={costSourceHint(source)}
    >
      {costSourceLabel(source)}
    </span>
  );
}
