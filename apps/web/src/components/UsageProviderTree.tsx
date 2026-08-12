/**
 * @file apps/web/src/components/UsageProviderTree.tsx
 * Collapsible provider → model usage tree (credit totals only).
 */

"use client";

import { useState } from "react";
import type { UsageModelBreakdown, UsageProviderBreakdown } from "@tradingagents/api-types";
import { AGENTS_MODEL_DISPLAY_NAME } from "@tradingagents/api-types";
import { formatComputeCredits } from "@/lib/billing-display";
import styles from "./BillingPageContent.module.css";

interface UsageProviderTreeProps {
  byProvider: UsageProviderBreakdown[];
  byModel: UsageModelBreakdown[];
}

export default function UsageProviderTree({ byProvider, byModel }: UsageProviderTreeProps) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  function handleToggle(providerId: string) {
    setExpanded((current) => ({
      ...current,
      [providerId]: !current[providerId],
    }));
  }

  return (
    <ul className={styles.providerTree} aria-label="Usage by provider">
      {byProvider.map((provider) => {
        const models = byModel.filter((row) => row.providerId === provider.providerId);
        const isOpen = expanded[provider.providerId] ?? false;
        const panelId = `provider-models-${provider.providerId}`;

        return (
          <li key={provider.providerId} className={styles.providerTreeItem}>
            <button
              type="button"
              className={styles.providerToggle}
              aria-expanded={isOpen}
              aria-controls={panelId}
              aria-label={`${isOpen ? "Collapse" : "Expand"} ${provider.providerLabel} models`}
              onClick={() => handleToggle(provider.providerId)}
            >
              <span className={styles.providerTitleRow}>
                <span className={styles.providerChevron} aria-hidden="true">
                  {isOpen ? "▾" : "▸"}
                </span>
                <span className={styles.providerName}>{provider.providerLabel}</span>
              </span>
              <span className={styles.providerAggregate}>
                <span>{formatComputeCredits(provider.computeCredits)} credits</span>
              </span>
            </button>

            {isOpen ? (
              <ul id={panelId} className={styles.modelTree}>
                {models.map((model) => (
                  <li
                    key={`${model.providerId}-${model.modelId}`}
                    className={styles.modelTreeRow}
                  >
                    <div className={styles.modelTitleRow}>
                      <strong className={styles.modelId}>{AGENTS_MODEL_DISPLAY_NAME}</strong>
                    </div>
                    <p className={styles.modelStats}>
                      {formatComputeCredits(model.computeCredits)} compute credits
                    </p>
                  </li>
                ))}
              </ul>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
