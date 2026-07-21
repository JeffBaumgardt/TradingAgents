/**
 * @file apps/web/src/components/UsageProviderTree.tsx
 * Collapsible provider → model usage tree (numbers only; no per-row bars).
 */

"use client";

import { useState } from "react";
import type { UsageModelBreakdown, UsageProviderBreakdown } from "@tradingagents/api-types";
import ProviderCostBadge from "@/components/ProviderCostBadge";
import {
  formatComputeCredits,
  formatCreditMultiplier,
  formatTokenCount,
} from "@/lib/billing-display";
import styles from "./BillingPageContent.module.css";

interface UsageProviderTreeProps {
  byProvider: UsageProviderBreakdown[];
  byModel: UsageModelBreakdown[];
}

export default function UsageProviderTree({ byProvider, byModel }: UsageProviderTreeProps) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(byProvider.map((row) => [row.providerId, true])),
  );

  function handleToggle(providerId: string) {
    setExpanded((current) => ({
      ...current,
      [providerId]: !current[providerId],
    }));
  }

  function handleToggleKeyDown(
    event: React.KeyboardEvent<HTMLButtonElement>,
    providerId: string,
  ) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      handleToggle(providerId);
    }
  }

  return (
    <ul className={styles.providerTree} aria-label="Usage by provider">
      {byProvider.map((provider) => {
        const models = byModel.filter((row) => row.providerId === provider.providerId);
        const isOpen = expanded[provider.providerId] ?? false;
        const panelId = `provider-models-${provider.providerId}`;

        return (
          <li key={provider.providerId} className={styles.providerTreeItem}>
            <div className={styles.providerTreeHeader}>
              <button
                type="button"
                className={styles.providerToggle}
                aria-expanded={isOpen}
                aria-controls={panelId}
                aria-label={`${isOpen ? "Collapse" : "Expand"} ${provider.providerLabel} models`}
                onClick={() => handleToggle(provider.providerId)}
                onKeyDown={(event) => handleToggleKeyDown(event, provider.providerId)}
              >
                <span className={styles.providerChevron} aria-hidden="true">
                  {isOpen ? "▾" : "▸"}
                </span>
                <span className={styles.providerName}>{provider.providerLabel}</span>
              </button>
              <div className={styles.providerAggregate}>
                <span>
                  {formatTokenCount(provider.tokensTotal)} tokens ·{" "}
                  {formatComputeCredits(provider.computeCredits)} credits
                </span>
                <span className={styles.providerSplit}>
                  Hosted {formatTokenCount(provider.hostedTokens)}
                  {provider.selfPayTokens > 0
                    ? ` · Your key ${formatTokenCount(provider.selfPayTokens)}`
                    : ""}
                </span>
              </div>
            </div>

            {isOpen ? (
              <ul id={panelId} className={styles.modelTree}>
                {models.map((model) => (
                  <li
                    key={`${model.providerId}-${model.modelId}-${model.costSource}`}
                    className={styles.modelTreeRow}
                  >
                    <div className={styles.modelTitleRow}>
                      <strong className={styles.modelId}>{model.modelId}</strong>
                      <span
                        className={styles.multiplierChip}
                        title="Compute credit multiplier from API output $/1M tokens"
                      >
                        {formatCreditMultiplier(model.creditMultiplier)}
                      </span>
                      <ProviderCostBadge source={model.costSource} />
                    </div>
                    <p className={styles.modelStats}>
                      {formatTokenCount(model.tokensTotal)} tokens
                      {model.computeCredits > 0
                        ? ` · ${formatComputeCredits(model.computeCredits)} compute credits`
                        : " · excluded from allowance"}
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
