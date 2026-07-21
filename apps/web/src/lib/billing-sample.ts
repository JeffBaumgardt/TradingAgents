/**
 * @file apps/web/src/lib/billing-sample.ts
 * Sample hosted billing account for UI previews and screenshots.
 */

import type { BillingAccountResponse, UsageModelBreakdown } from "@tradingagents/api-types";
import {
  HOSTED_MONTHLY_COMPUTE_CREDIT_ALLOWANCE,
  getModelCreditMultiplier,
} from "@tradingagents/api-types";

function hostedModelRow(
  providerId: string,
  providerLabel: string,
  modelId: string,
  tokensTotal: number,
): UsageModelBreakdown {
  const creditMultiplier = getModelCreditMultiplier(providerId, modelId);
  return {
    providerId,
    providerLabel,
    modelId,
    tokensTotal,
    computeCredits: Math.round(tokensTotal * creditMultiplier),
    creditMultiplier,
    costSource: "hosted",
    shareOfCredits: 0,
  };
}

export function buildSampleBillingAccount(): BillingAccountResponse {
  const periodStart = new Date();
  periodStart.setUTCDate(1);
  periodStart.setUTCHours(0, 0, 0, 0);
  const periodEnd = new Date(periodStart);
  periodEnd.setUTCMonth(periodEnd.getUTCMonth() + 1);

  // Token volumes sized so weighted compute credits land ~40–60% of the 10M allowance.
  const byModel: UsageModelBreakdown[] = [
    hostedModelRow("openai", "OpenAI", "gpt-5.4-mini", 44_000),
    hostedModelRow("openai", "OpenAI", "gpt-5.5", 8_000),
    hostedModelRow("anthropic", "Anthropic", "claude-opus-4-8", 12_000),
    hostedModelRow("anthropic", "Anthropic", "claude-haiku-4-5", 36_000),
    {
      providerId: "anthropic",
      providerLabel: "Anthropic",
      modelId: "claude-sonnet-4-6",
      tokensTotal: 56_000,
      computeCredits: 0,
      creditMultiplier: getModelCreditMultiplier("anthropic", "claude-sonnet-4-6"),
      costSource: "self_pay",
      shareOfCredits: 0,
    },
    hostedModelRow("google", "Google", "gemini-3.5-flash", 36_000),
    hostedModelRow("xai", "xAI", "grok-4.3", 28_000),
    hostedModelRow("deepseek", "DeepSeek", "deepseek-v4-flash", 90_000),
  ];

  const usedComputeCredits = byModel.reduce((sum, row) => sum + row.computeCredits, 0);
  for (const row of byModel) {
    row.shareOfCredits =
      usedComputeCredits > 0 ? row.computeCredits / usedComputeCredits : 0;
  }

  const providerIds = ["openai", "anthropic", "google", "xai", "deepseek"] as const;
  const byProvider = providerIds
    .map((providerId) => {
      const rows = byModel.filter((row) => row.providerId === providerId);
      if (rows.length === 0) {
        return null;
      }
      const computeCredits = rows.reduce((sum, row) => sum + row.computeCredits, 0);
      const tokensTotal = rows.reduce((sum, row) => sum + row.tokensTotal, 0);
      const selfPayTokens = rows
        .filter((row) => row.costSource === "self_pay")
        .reduce((sum, row) => sum + row.tokensTotal, 0);
      return {
        providerId,
        providerLabel: rows[0]?.providerLabel ?? providerId,
        tokensTotal,
        computeCredits,
        selfPayTokens,
        hostedTokens: tokensTotal - selfPayTokens,
        shareOfCredits: usedComputeCredits > 0 ? computeCredits / usedComputeCredits : 0,
      };
    })
    .filter((row): row is NonNullable<typeof row> => row !== null)
    .sort((a, b) => b.computeCredits - a.computeCredits || b.tokensTotal - a.tokensTotal);

  const hostedTokens = byModel
    .filter((row) => row.costSource === "hosted")
    .reduce((sum, row) => sum + row.tokensTotal, 0);
  const selfPayTokens = byModel
    .filter((row) => row.costSource === "self_pay")
    .reduce((sum, row) => sum + row.tokensTotal, 0);

  return {
    subscription: {
      planId: "hosted",
      interval: "monthly",
      status: "active",
      currentPeriodStart: periodStart.toISOString(),
      currentPeriodEnd: periodEnd.toISOString(),
    },
    usage: {
      isSample: true,
      periodStart: periodStart.toISOString(),
      periodEnd: periodEnd.toISOString(),
      baseAllowanceComputeCredits: HOSTED_MONTHLY_COMPUTE_CREDIT_ALLOWANCE,
      rolloverComputeCredits: 0,
      allowanceComputeCredits: HOSTED_MONTHLY_COMPUTE_CREDIT_ALLOWANCE,
      usedComputeCredits,
      remainingComputeCredits: HOSTED_MONTHLY_COMPUTE_CREDIT_ALLOWANCE - usedComputeCredits,
      usedRatio: Math.min(1, usedComputeCredits / HOSTED_MONTHLY_COMPUTE_CREDIT_ALLOWANCE),
      blockedLowBalance: false,
      tokensTotal: hostedTokens + selfPayTokens,
      selfPayTokens,
      hostedTokens,
      byProvider,
      byModel,
    },
    hostedProviderIds: ["openai", "anthropic", "google", "xai", "openrouter", "deepseek"],
  };
}
