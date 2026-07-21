/**
 * @file apps/web/src/components/pricing/PricingBillingToggle.tsx
 * Monthly / annual billing interval control for pricing layouts.
 */

"use client";

import { useRef, type KeyboardEvent } from "react";
import type { BillingInterval } from "@/lib/pricing-content";
import { ANNUAL_DISCOUNT_PERCENT } from "@/lib/pricing-content";
import styles from "./PricingBillingToggle.module.css";

const INTERVALS: BillingInterval[] = ["monthly", "annual"];

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
  const monthlyRef = useRef<HTMLButtonElement>(null);
  const annualRef = useRef<HTMLButtonElement>(null);

  function handleSelect(interval: BillingInterval) {
    onChange(interval);
    requestAnimationFrame(() => {
      const target = interval === "monthly" ? monthlyRef.current : annualRef.current;
      target?.focus();
    });
  }

  function handleKeyDown(
    event: KeyboardEvent<HTMLButtonElement>,
    interval: BillingInterval,
  ) {
    const currentIndex = INTERVALS.indexOf(interval);
    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      event.preventDefault();
      handleSelect(INTERVALS[(currentIndex + 1) % INTERVALS.length]!);
      return;
    }
    if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      event.preventDefault();
      handleSelect(
        INTERVALS[(currentIndex - 1 + INTERVALS.length) % INTERVALS.length]!,
      );
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
          ref={monthlyRef}
          type="button"
          role="radio"
          aria-checked={value === "monthly"}
          tabIndex={value === "monthly" ? 0 : -1}
          aria-label="Monthly billing"
          className={value === "monthly" ? styles.optionActive : styles.option}
          onClick={() => handleSelect("monthly")}
          onKeyDown={(event) => handleKeyDown(event, "monthly")}
        >
          Monthly
        </button>
        <button
          ref={annualRef}
          type="button"
          role="radio"
          aria-checked={value === "annual"}
          tabIndex={value === "annual" ? 0 : -1}
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
