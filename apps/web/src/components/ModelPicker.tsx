/**
 * @file apps/web/src/components/ModelPicker.tsx
 * Accessible model list (replaces native <select> for richer spend UI).
 */

"use client";

import { useId, useMemo, useRef } from "react";
import type { ModelOption } from "@tradingagents/api-types";
import {
  creditSpendTierFromMultiplier,
  creditSpendTierLabel,
  estimateTypicalRunsPerMonth,
  formatCreditMultiplier,
  formatCreditSpendDollars,
  formatTokenCount,
} from "@/lib/billing-display";
import styles from "./ModelPicker.module.css";

interface ModelPickerProps {
  id?: string;
  models: ModelOption[];
  value: string;
  onChange: (modelId: string) => void;
  /** When false (BYOK / self-pay), hide 💵 and run estimates; still sort by effort. */
  showCreditSpend?: boolean;
  labelledBy?: string;
  describedBy?: string;
}

function splitModelLabel(label: string): { name: string; description: string | null } {
  const separator = " - ";
  const index = label.indexOf(separator);
  if (index === -1) {
    return { name: label, description: null };
  }
  return {
    name: label.slice(0, index).trim(),
    description: label.slice(index + separator.length).trim() || null,
  };
}

export default function ModelPicker({
  id,
  models,
  value,
  onChange,
  showCreditSpend = true,
  labelledBy,
  describedBy,
}: ModelPickerProps) {
  const generatedId = useId();
  const listId = id ?? generatedId;
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const rows = useMemo(
    () =>
      [...models]
        .sort((a, b) => {
          const aRank =
            a.id === "custom" ? Number.POSITIVE_INFINITY : (a.creditMultiplier ?? Number.POSITIVE_INFINITY);
          const bRank =
            b.id === "custom" ? Number.POSITIVE_INFINITY : (b.creditMultiplier ?? Number.POSITIVE_INFINITY);
          if (aRank !== bRank) {
            return aRank - bRank;
          }
          return a.label.localeCompare(b.label);
        })
        .map((model) => {
          const { name, description } = splitModelLabel(model.label);
          const multiplier = model.creditMultiplier;
          const hasSpendMeta =
            showCreditSpend && multiplier != null && Number.isFinite(multiplier);
          const tier = hasSpendMeta ? creditSpendTierFromMultiplier(multiplier) : null;
          const runs = hasSpendMeta ? estimateTypicalRunsPerMonth(multiplier) : null;
          return {
            model,
            name,
            description,
            hasSpendMeta,
            dollars: hasSpendMeta ? formatCreditSpendDollars(multiplier) : null,
            multiplierLabel: hasSpendMeta ? formatCreditMultiplier(multiplier) : null,
            tierLabel: tier != null ? creditSpendTierLabel(tier) : null,
            runsLabel: runs != null ? `~${formatTokenCount(runs)}/mo` : null,
          };
        }),
    [models, showCreditSpend],
  );

  function handleSelect(modelId: string) {
    onChange(modelId);
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (rows.length === 0) {
      return;
    }

    const currentIndex = Math.max(
      0,
      rows.findIndex((row) => row.model.id === value),
    );

    let nextIndex = currentIndex;
    if (event.key === "ArrowDown" || event.key === "ArrowRight") {
      event.preventDefault();
      nextIndex = (currentIndex + 1) % rows.length;
    } else if (event.key === "ArrowUp" || event.key === "ArrowLeft") {
      event.preventDefault();
      nextIndex = (currentIndex - 1 + rows.length) % rows.length;
    } else if (event.key === "Home") {
      event.preventDefault();
      nextIndex = 0;
    } else if (event.key === "End") {
      event.preventDefault();
      nextIndex = rows.length - 1;
    } else {
      return;
    }

    const nextId = rows[nextIndex]?.model.id;
    if (!nextId) {
      return;
    }
    onChange(nextId);
    optionRefs.current[nextIndex]?.focus();
  }

  return (
    <div
      id={listId}
      className={styles.list}
      role="listbox"
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      aria-activedescendant={value ? `${listId}-${value}` : undefined}
      tabIndex={0}
      onKeyDown={handleKeyDown}
    >
      {rows.map((row, index) => {
        const selected = row.model.id === value;
        const optionId = `${listId}-${row.model.id}`;
        const optionClass = row.hasSpendMeta
          ? selected
            ? styles.optionSelected
            : styles.option
          : selected
            ? styles.optionPlainSelected
            : styles.optionPlain;
        return (
          <button
            key={row.model.id}
            id={optionId}
            ref={(node) => {
              optionRefs.current[index] = node;
            }}
            type="button"
            role="option"
            aria-selected={selected}
            className={optionClass}
            onClick={() => handleSelect(row.model.id)}
            tabIndex={-1}
          >
            <span className={styles.optionMain}>
              <span className={styles.optionName}>{row.name}</span>
              {row.description ? (
                <span className={styles.optionDescription}>{row.description}</span>
              ) : null}
            </span>
            {row.hasSpendMeta ? (
              <span className={styles.optionMeta}>
                <span
                  className={styles.spend}
                  title={`${row.tierLabel} · ${row.multiplierLabel}`}
                  aria-label={`${row.tierLabel} spend, ${row.multiplierLabel}`}
                >
                  {row.dollars}
                </span>
                <span className={styles.runs}>{row.runsLabel}</span>
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
