/**
 * @file apps/web/src/lib/billing-display.ts
 * Formatting helpers for subscription + usage UI.
 */

import type { ProviderCostSource } from "@tradingagents/api-types";

export function formatTokenCount(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}

/** Compact formatter for compute credits (and legacy billable-unit callers). */
export function formatComputeCredits(value: number): string {
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(value % 1_000_000 === 0 ? 0 : 1)}M`;
  }
  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(value % 1_000 === 0 ? 0 : 1)}k`;
  }
  return formatTokenCount(value);
}

/** @deprecated Use {@link formatComputeCredits}. */
export function formatBillableUnits(value: number): string {
  return formatComputeCredits(value);
}

export function formatCreditMultiplier(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? `×${rounded}` : `×${rounded.toFixed(1)}`;
}

export function formatPeriodEnd(iso: string | null | undefined): string {
  if (!iso) {
    return "—";
  }
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(iso));
}

export function costSourceLabel(source: ProviderCostSource): string {
  if (source === "self_pay") {
    return "Your key";
  }
  return "Hosted";
}

export function costSourceHint(source: ProviderCostSource): string {
  if (source === "self_pay") {
    return "Billed by your provider — does not use compute credits";
  }
  return "Runs on platform keys — counts toward your compute credit allowance";
}
