/**
 * apps/api/src/lib/billable-units.ts
 *
 * Convert raw tokens into compute credits.
 * 1 input token = 1 credit, 1 output token = 5 credits, then 5% margin.
 */

import { computeAgentsModelCredits } from "@tradingagents/api-types";

/** @deprecated Prefer {@link computeAgentsModelCredits}. */
export function getModelBillableWeight(_providerId: string, _modelId: string): number {
  return 1;
}

export function computeBillableUnits(input: {
  tokensIn: number;
  tokensOut: number;
  providerId: string;
  modelId: string;
}): number {
  return computeCredits(input);
}

/** Normalize tokens into compute credits (input × 1 + output × 5 × margin). */
export function computeCredits(input: {
  tokensIn: number;
  tokensOut: number;
  providerId: string;
  modelId: string;
}): number {
  return computeAgentsModelCredits(input.tokensIn, input.tokensOut);
}
