/**
 * @file apps/web/src/components/UpgradePlanNudge.tsx
 * CTA to unlock hosted providers / models without a personal API key.
 */

import Link from "next/link";
import styles from "./UpgradePlanNudge.module.css";

interface UpgradePlanNudgeProps {
  providerLabel: string;
  compact?: boolean;
}

export default function UpgradePlanNudge({
  providerLabel,
  compact = false,
}: UpgradePlanNudgeProps) {
  return (
    <aside
      className={compact ? styles.compact : styles.nudge}
      aria-label="Upgrade to hosted models"
    >
      <p className={styles.copy}>
        {compact
          ? `Need ${providerLabel} without your own key?`
          : `You don’t have a ${providerLabel} API key saved. Upgrade to Hosted models to use ${providerLabel} on platform keys (counts toward your monthly allowance), or add your own key to keep usage on your provider bill.`}
      </p>
      <div className={styles.actions}>
        <Link
          href="/checkout?plan=hosted&interval=monthly"
          className={styles.primary}
          aria-label="Upgrade to hosted models"
        >
          Upgrade to Hosted
        </Link>
        <Link
          href="/settings/credentials"
          className={styles.secondary}
          aria-label="Add your own API key"
        >
          Add your key
        </Link>
      </div>
    </aside>
  );
}
