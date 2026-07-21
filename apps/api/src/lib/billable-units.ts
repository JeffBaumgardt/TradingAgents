/**
 * apps/api/src/lib/billable-units.ts
 *
 * Provisional model weights — high tilt toward expensive models until a real
 * cost matrix lands. Self-pay traffic still records raw tokens but 0 billable units.
 */

import type { ProviderCostSource } from "@tradingagents/api-types";

/**
 * Returns a relative weight for normalizing tokens into billable units.
 * Higher = eats the hosted allowance faster.
 */
export function getModelBillableWeight(providerId: string, modelId: string): number {
  const model = modelId.toLowerCase();
  const provider = providerId.toLowerCase();

  if (
    model.includes("haiku") ||
    model.includes("flash") ||
    model.includes("mini") ||
    model.includes("nano")
  ) {
    return 1;
  }

  if (
    model.includes("opus") ||
    model.includes("o1") ||
    model.includes("o3") ||
    model.includes("gpt-4.5") ||
    model.includes("reasoning")
  ) {
    return 8;
  }

  if (
    model.includes("sonnet") ||
    model.includes("gpt-4") ||
    model.includes("claude-3") ||
    provider === "anthropic"
  ) {
    return 3;
  }

  return 2;
}

export function computeBillableUnits(input: {
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
  const weight = getModelBillableWeight(input.providerId, input.modelId);
  return Math.round(raw * weight);
}
