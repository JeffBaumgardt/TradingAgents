/**
 * @file apps/web/src/lib/billing-sample.ts
 * Sample hosted billing account for UI previews and screenshots.
 */

import type { BillingAccountResponse } from "@tradingagents/api-types";
import { HOSTED_MONTHLY_BILLABLE_ALLOWANCE } from "@tradingagents/api-types";

export function buildSampleBillingAccount(): BillingAccountResponse {
  const periodStart = new Date();
  periodStart.setUTCDate(1);
  periodStart.setUTCHours(0, 0, 0, 0);
  const periodEnd = new Date(periodStart);
  periodEnd.setUTCMonth(periodEnd.getUTCMonth() + 1);

  const byModel = [
    {
      providerId: "openai",
      providerLabel: "OpenAI",
      modelId: "gpt-4o",
      tokensTotal: 58_000,
      billableUnits: 174_000,
      costSource: "hosted" as const,
      shareOfBillable: 0,
    },
    {
      providerId: "anthropic",
      providerLabel: "Anthropic",
      modelId: "claude-opus-4",
      tokensTotal: 20_000,
      billableUnits: 160_000,
      costSource: "hosted" as const,
      shareOfBillable: 0,
    },
    {
      providerId: "google",
      providerLabel: "Google",
      modelId: "gemini-2.0-flash",
      tokensTotal: 130_000,
      billableUnits: 130_000,
      costSource: "hosted" as const,
      shareOfBillable: 0,
    },
    {
      providerId: "anthropic",
      providerLabel: "Anthropic",
      modelId: "claude-sonnet-4",
      tokensTotal: 77_000,
      billableUnits: 0,
      costSource: "self_pay" as const,
      shareOfBillable: 0,
    },
  ];

  const usedBillableUnits = byModel.reduce((sum, row) => sum + row.billableUnits, 0);
  for (const row of byModel) {
    row.shareOfBillable =
      usedBillableUnits > 0 ? row.billableUnits / usedBillableUnits : 0;
  }

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
      allowanceBillableUnits: HOSTED_MONTHLY_BILLABLE_ALLOWANCE,
      usedBillableUnits,
      remainingBillableUnits: HOSTED_MONTHLY_BILLABLE_ALLOWANCE - usedBillableUnits,
      usedRatio: usedBillableUnits / HOSTED_MONTHLY_BILLABLE_ALLOWANCE,
      tokensTotal: byModel.reduce((sum, row) => sum + row.tokensTotal, 0),
      selfPayTokens: 77_000,
      hostedTokens: 208_000,
      byProvider: [
        {
          providerId: "openai",
          providerLabel: "OpenAI",
          tokensTotal: 58_000,
          billableUnits: 174_000,
          selfPayTokens: 0,
          hostedTokens: 58_000,
          shareOfBillable: 0.45,
        },
        {
          providerId: "anthropic",
          providerLabel: "Anthropic",
          tokensTotal: 97_000,
          billableUnits: 160_000,
          selfPayTokens: 77_000,
          hostedTokens: 20_000,
          shareOfBillable: 0.42,
        },
        {
          providerId: "google",
          providerLabel: "Google",
          tokensTotal: 130_000,
          billableUnits: 130_000,
          selfPayTokens: 0,
          hostedTokens: 130_000,
          shareOfBillable: 0.13,
        },
      ],
      byModel,
    },
    hostedProviderIds: ["openai", "anthropic", "google", "xai", "openrouter", "deepseek"],
  };
}
