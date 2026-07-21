/**
 * apps/api/src/lib/billable-units.ts
 *
 * Convert raw tokens into compute credits using the curated hosted cost catalog.
 * Self-pay traffic still records raw tokens but 0 compute credits.
 */

import type { ProviderCostSource } from "@tradingagents/api-types";
import { getModelCreditMultiplier } from "@tradingagents/api-types";

/** @deprecated Prefer {@link getModelCreditMultiplier}. */
export function getModelBillableWeight(providerId: string, modelId: string): number {
  return getModelCreditMultiplier(providerId, modelId);
}

export function computeBillableUnits(input: {
  tokensIn: number;
  tokensOut: number;
  providerId: string;
  modelId: string;
  costSource: ProviderCostSource;
}): number {
  return computeCredits(input);
}

/** Normalize hosted tokens into compute credits via output-cost multipliers. */
export function computeCredits(input: {
  tokensIn: number;
  tokensOut: number;
  providerId: string;
  modelId: string;
  costSource: ProviderCostSource;
}): number {
  if (input.costSource === "self_pay") {
    return 0;
  }

  const raw = Math.max(0, input.tokensIn) + Math.max(0, input.tokensOut);
  const multiplier = getModelCreditMultiplier(input.providerId, input.modelId);
  return Math.round(raw * multiplier);
}
