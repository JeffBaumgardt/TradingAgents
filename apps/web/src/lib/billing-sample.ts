/**
 * @file apps/web/src/lib/billing-sample.ts
 * Sample billing account for UI previews and screenshots.
 */

import type { BillingAccountResponse, UsageModelBreakdown } from "@tradingagents/api-types";
import {
  AGENTS_MODEL_DISPLAY_NAME,
  AGENTS_MODEL_ID,
  AGENTS_MODEL_PROVIDER_ID,
  PRO_MONTHLY_COMPUTE_CREDIT_ALLOWANCE,
  computeAgentsModelCredits,
  planFeaturesFor,
} from "@tradingagents/api-types";

function agentsModelRow(tokensIn: number, tokensOut: number): UsageModelBreakdown {
  return {
    providerId: AGENTS_MODEL_PROVIDER_ID,
    providerLabel: "Agents Model",
    modelId: AGENTS_MODEL_ID,
    tokensTotal: tokensIn + tokensOut,
    computeCredits: computeAgentsModelCredits(tokensIn, tokensOut),
    creditMultiplier: 0,
    shareOfCredits: 0,
  };
}

export function buildSampleBillingAccount(): BillingAccountResponse {
  const periodStart = new Date();
  periodStart.setUTCDate(1);
  periodStart.setUTCHours(0, 0, 0, 0);
  const periodEnd = new Date(periodStart);
  periodEnd.setUTCMonth(periodEnd.getUTCMonth() + 1);

  const byModel: UsageModelBreakdown[] = [
    agentsModelRow(160_000, 40_000),
    agentsModelRow(60_000, 15_000),
  ];

  const usedComputeCredits = byModel.reduce((sum, row) => sum + row.computeCredits, 0);
  for (const row of byModel) {
    row.shareOfCredits =
      usedComputeCredits > 0 ? row.computeCredits / usedComputeCredits : 0;
  }

  const tokensTotal = byModel.reduce((sum, row) => sum + row.tokensTotal, 0);
  const allowance = PRO_MONTHLY_COMPUTE_CREDIT_ALLOWANCE;

  return {
    subscription: {
      planId: "pro",
      interval: "monthly",
      status: "active",
      currentPeriodStart: periodStart.toISOString(),
      currentPeriodEnd: periodEnd.toISOString(),
      cancelAtPeriodEnd: false,
      isTrial: false,
      trialEndsAt: null,
    },
    usage: {
      isSample: true,
      periodStart: periodStart.toISOString(),
      periodEnd: periodEnd.toISOString(),
      baseAllowanceComputeCredits: allowance,
      rolloverComputeCredits: 0,
      allowanceComputeCredits: allowance,
      usedComputeCredits,
      remainingComputeCredits: Math.max(0, allowance - usedComputeCredits),
      usedRatio: Math.min(1, usedComputeCredits / allowance),
      blockedLowBalance: false,
      tokensTotal,
      byProvider: [
        {
          providerId: AGENTS_MODEL_PROVIDER_ID,
          providerLabel: "Agents Model",
          tokensTotal,
          computeCredits: usedComputeCredits,
          shareOfCredits: 1,
        },
      ],
      byModel,
    },
    hostedProviderIds: [AGENTS_MODEL_PROVIDER_ID],
    features: planFeaturesFor("pro"),
    agentsModelDisplayName: AGENTS_MODEL_DISPLAY_NAME,
  };
}
