/**
 * @file apps/web/src/components/pricing/PricingBillingToggle.tsx
 * Monthly / annual billing interval control for pricing layouts.
 */

"use client";

import type { KeyboardEvent } from "react";
import type { BillingInterval } from "@/lib/pricing-content";
import { ANNUAL_DISCOUNT_PERCENT } from "@/lib/pricing-content";
import styles from "./PricingBillingToggle.module.css";

interface PricingBillingToggleProps {
  value: BillingInterval;
  onChange: (interval: BillingInterval) => void;
  idPrefix?: string;
}

export default function PricingBillingToggle({
  value,
  onChange,
  idPrefix = "billing",
}: PricingBillingToggleProps) {
  const groupId = `${idPrefix}-interval`;

  function handleSelect(interval: BillingInterval) {
    onChange(interval);
  }

  function handleKeyDown(
    event: KeyboardEvent<HTMLButtonElement>,
    interval: BillingInterval,
  ) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      handleSelect(interval);
    }
  }

  return (
    <div className={styles.wrap}>
      <div
        className={styles.toggle}
        role="radiogroup"
        aria-labelledby={`${groupId}-label`}
      >
        <span id={`${groupId}-label`} className={styles.srOnly}>
          Billing interval
        </span>
        <button
          type="button"
          role="radio"
          aria-checked={value === "monthly"}
          tabIndex={0}
          aria-label="Monthly billing"
          className={value === "monthly" ? styles.optionActive : styles.option}
          onClick={() => handleSelect("monthly")}
          onKeyDown={(event) => handleKeyDown(event, "monthly")}
        >
          Monthly
        </button>
        <button
          type="button"
          role="radio"
          aria-checked={value === "annual"}
          tabIndex={0}
          aria-label="Annual billing"
          className={value === "annual" ? styles.optionActive : styles.option}
          onClick={() => handleSelect("annual")}
          onKeyDown={(event) => handleKeyDown(event, "annual")}
        >
          Annual
          <span className={styles.saveBadge}>Save {ANNUAL_DISCOUNT_PERCENT}%</span>
        </button>
      </div>
    </div>
  );
}
