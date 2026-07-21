/**
 * @file apps/web/src/lib/billing-display.ts
 * Formatting helpers for subscription + usage UI.
 */

import type { ProviderCostSource } from "@tradingagents/api-types";
import { HOSTED_MONTHLY_COMPUTE_CREDIT_ALLOWANCE } from "@tradingagents/api-types";

/** Dollar-emoji spend scale used in the wizard (1 = budget … 5 = frontier). */
export const CREDIT_SPEND_TIER_MAX = 5;

/**
 * Typical depth-1 multi-agent analysis size used for “runs / month” estimates
 * (~42.6k in + 6.8k out observed on gpt-4o-mini).
 */
export const TYPICAL_HOSTED_ANALYSIS_TOKENS = 50_000;

/** Leave ~3% headroom so estimates match the low-balance block floor. */
export const HOSTED_CREDIT_USABLE_RATIO = 0.97;

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

/**
 * Map a credit multiplier onto a 1–5 spend tier for 💵 display.
 * Buckets track catalog tiers (budget mini → frontier opus / gpt-5.5).
 */
export function creditSpendTierFromMultiplier(multiplier: number): number {
  if (!Number.isFinite(multiplier) || multiplier <= 0) {
    return 1;
  }
  if (multiplier <= 6) {
    return 1;
  }
  if (multiplier <= 12) {
    return 2;
  }
  if (multiplier <= 25) {
    return 3;
  }
  if (multiplier <= 60) {
    return 4;
  }
  return CREDIT_SPEND_TIER_MAX;
}

/** Render 💵…💵💵💵💵💵 from a credit multiplier. */
export function formatCreditSpendDollars(multiplier: number): string {
  const tier = creditSpendTierFromMultiplier(multiplier);
  return "💵".repeat(tier);
}

export function creditSpendTierLabel(tier: number): string {
  switch (tier) {
    case 1:
      return "Budget";
    case 2:
      return "Light";
    case 3:
      return "Standard";
    case 4:
      return "Heavy";
    default:
      return "Frontier";
  }
}

/** Estimated Hosted analyses per month at a typical token volume. */
export function estimateTypicalRunsPerMonth(
  creditMultiplier: number,
  options?: {
    tokensPerRun?: number;
    allowanceCredits?: number;
    usableRatio?: number;
  },
): number {
  if (!Number.isFinite(creditMultiplier) || creditMultiplier <= 0) {
    return 0;
  }
  const tokens = options?.tokensPerRun ?? TYPICAL_HOSTED_ANALYSIS_TOKENS;
  const allowance = options?.allowanceCredits ?? HOSTED_MONTHLY_COMPUTE_CREDIT_ALLOWANCE;
  const usableRatio = options?.usableRatio ?? HOSTED_CREDIT_USABLE_RATIO;
  const creditsPerRun = tokens * creditMultiplier;
  if (creditsPerRun <= 0) {
    return 0;
  }
  return Math.floor((allowance * usableRatio) / creditsPerRun);
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
