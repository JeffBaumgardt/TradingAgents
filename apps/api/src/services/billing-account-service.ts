/**
 * apps/api/src/services/billing-account-service.ts
 *
 * Subscription + usage account view. Persists to Postgres when available;
 * falls back to an in-process scaffold store so UI can be reviewed before Stripe.
 */

import {
  BILLING_CATALOG,
  HOSTED_MONTHLY_COMPUTE_CREDIT_ALLOWANCE,
  getModelCreditMultiplier,
  type BillingAccountResponse,
  type BillingInterval,
  type BillingPlanId,
  type BillingUsageSummary,
  type ProviderCostSource,
  type UsageModelBreakdown,
  type UsageProviderBreakdown,
  type UserSubscription,
} from "@tradingagents/api-types";
import type { AppSupabaseClient } from "@tradingagents/supabase";
import { computeCredits } from "../lib/billable-units.js";

const PROVIDER_LABELS: Record<string, string> = {
  openai: "OpenAI",
  anthropic: "Anthropic",
  google: "Google",
  xai: "xAI",
  openrouter: "OpenRouter",
  ollama: "Ollama",
  deepseek: "DeepSeek",
};

/** Providers available through platform keys on the hosted plan. */
export const HOSTED_PROVIDER_IDS = [
  "openai",
  "anthropic",
  "google",
  "xai",
  "openrouter",
  "deepseek",
] as const;

interface UsageEventRow {
  provider_id: string;
  model_id: string;
  tokens_in: number;
  tokens_out: number;
  billable_units: number;
  cost_source: ProviderCostSource;
}

interface ScaffoldSubscription {
  planId: BillingPlanId;
  interval: BillingInterval;
  status: "active";
  currentPeriodStart: string;
  currentPeriodEnd: string;
}

const scaffoldSubscriptions = new Map<string, ScaffoldSubscription>();
const scaffoldUsage = new Map<string, UsageEventRow[]>();

function providerLabel(providerId: string): string {
  return PROVIDER_LABELS[providerId] ?? providerId;
}

function startOfUtcMonth(date = new Date()): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1, 0, 0, 0));
}

function endOfUtcMonth(date = new Date()): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0, 23, 59, 59));
}

function addMonthsIso(startIso: string, months: number): string {
  const start = new Date(startIso);
  const end = new Date(start);
  end.setUTCMonth(end.getUTCMonth() + months);
  return end.toISOString();
}

function emptySubscription(): UserSubscription {
  return {
    planId: null,
    interval: null,
    status: "none",
    currentPeriodStart: null,
    currentPeriodEnd: null,
  };
}

function buildUsageSummary(
  events: UsageEventRow[],
  periodStart: string,
  periodEnd: string,
  isSample: boolean,
): BillingUsageSummary {
  const modelMap = new Map<string, UsageModelBreakdown>();
  const providerMap = new Map<string, UsageProviderBreakdown>();

  let usedComputeCredits = 0;
  let tokensTotal = 0;
  let selfPayTokens = 0;
  let hostedTokens = 0;

  for (const event of events) {
    const tokens = event.tokens_in + event.tokens_out;
    tokensTotal += tokens;
    usedComputeCredits += event.billable_units;
    if (event.cost_source === "self_pay") {
      selfPayTokens += tokens;
    } else {
      hostedTokens += tokens;
    }

    const modelKey = `${event.provider_id}::${event.model_id}`;
    const existingModel = modelMap.get(modelKey);
    if (existingModel) {
      existingModel.tokensTotal += tokens;
      existingModel.computeCredits += event.billable_units;
    } else {
      modelMap.set(modelKey, {
        providerId: event.provider_id,
        providerLabel: providerLabel(event.provider_id),
        modelId: event.model_id,
        tokensTotal: tokens,
        computeCredits: event.billable_units,
        creditMultiplier: getModelCreditMultiplier(event.provider_id, event.model_id),
        costSource: event.cost_source,
        shareOfCredits: 0,
      });
    }

    const existingProvider = providerMap.get(event.provider_id);
    if (existingProvider) {
      existingProvider.tokensTotal += tokens;
      existingProvider.computeCredits += event.billable_units;
      if (event.cost_source === "self_pay") {
        existingProvider.selfPayTokens += tokens;
      } else {
        existingProvider.hostedTokens += tokens;
      }
    } else {
      providerMap.set(event.provider_id, {
        providerId: event.provider_id,
        providerLabel: providerLabel(event.provider_id),
        tokensTotal: tokens,
        computeCredits: event.billable_units,
        selfPayTokens: event.cost_source === "self_pay" ? tokens : 0,
        hostedTokens: event.cost_source === "hosted" ? tokens : 0,
        shareOfCredits: 0,
      });
    }
  }

  const byModel = [...modelMap.values()]
    .map((row) => ({
      ...row,
      shareOfCredits: usedComputeCredits > 0 ? row.computeCredits / usedComputeCredits : 0,
    }))
    .sort((a, b) => b.computeCredits - a.computeCredits || b.tokensTotal - a.tokensTotal);

  const byProvider = [...providerMap.values()]
    .map((row) => ({
      ...row,
      shareOfCredits: usedComputeCredits > 0 ? row.computeCredits / usedComputeCredits : 0,
    }))
    .sort((a, b) => b.computeCredits - a.computeCredits || b.tokensTotal - a.tokensTotal);

  const allowance = HOSTED_MONTHLY_COMPUTE_CREDIT_ALLOWANCE;
  const usedRatio = allowance > 0 ? Math.min(1, usedComputeCredits / allowance) : 0;

  return {
    isSample,
    periodStart,
    periodEnd,
    allowanceComputeCredits: allowance,
    usedComputeCredits,
    remainingComputeCredits: Math.max(0, allowance - usedComputeCredits),
    usedRatio,
    tokensTotal,
    selfPayTokens,
    hostedTokens,
    byProvider,
    byModel,
  };
}

function sampleUsageEvents(): UsageEventRow[] {
  const samples: Array<{
    providerId: string;
    modelId: string;
    tokensIn: number;
    tokensOut: number;
    costSource: ProviderCostSource;
  }> = [
    {
      providerId: "anthropic",
      modelId: "claude-opus-4-8",
      tokensIn: 3_500,
      tokensOut: 2_500,
      costSource: "hosted",
    },
    {
      providerId: "anthropic",
      modelId: "claude-haiku-4-5",
      tokensIn: 12_000,
      tokensOut: 6_000,
      costSource: "hosted",
    },
    {
      providerId: "openai",
      modelId: "gpt-5.4-mini",
      tokensIn: 14_000,
      tokensOut: 8_000,
      costSource: "hosted",
    },
    {
      providerId: "openai",
      modelId: "gpt-5.5",
      tokensIn: 2_500,
      tokensOut: 1_500,
      costSource: "hosted",
    },
    {
      providerId: "google",
      modelId: "gemini-3.5-flash",
      tokensIn: 12_000,
      tokensOut: 6_000,
      costSource: "hosted",
    },
    {
      providerId: "anthropic",
      modelId: "claude-sonnet-4-6",
      tokensIn: 18_000,
      tokensOut: 10_000,
      costSource: "self_pay",
    },
    {
      providerId: "xai",
      modelId: "grok-4.3",
      tokensIn: 9_000,
      tokensOut: 5_000,
      costSource: "hosted",
    },
    {
      providerId: "deepseek",
      modelId: "deepseek-v4-flash",
      tokensIn: 30_000,
      tokensOut: 15_000,
      costSource: "hosted",
    },
  ];

  return samples.map((sample) => ({
    provider_id: sample.providerId,
    model_id: sample.modelId,
    tokens_in: sample.tokensIn,
    tokens_out: sample.tokensOut,
    billable_units: computeCredits({
      tokensIn: sample.tokensIn,
      tokensOut: sample.tokensOut,
      providerId: sample.providerId,
      modelId: sample.modelId,
      costSource: sample.costSource,
    }),
    cost_source: sample.costSource,
  }));
}

export async function activateScaffoldSubscription(
  _client: AppSupabaseClient,
  userId: string,
  planId: BillingPlanId,
  interval: BillingInterval,
): Promise<UserSubscription> {
  const periodStart = new Date().toISOString();
  const months = interval === "annual" ? 12 : 1;
  const periodEnd = addMonthsIso(periodStart, months);

  const subscription: ScaffoldSubscription = {
    planId,
    interval,
    status: "active",
    currentPeriodStart: periodStart,
    currentPeriodEnd: periodEnd,
  };
  scaffoldSubscriptions.set(userId, subscription);

  // Seed illustrative usage for hosted so the billing page is reviewable.
  if (planId === "hosted" && !scaffoldUsage.has(userId)) {
    scaffoldUsage.set(userId, sampleUsageEvents());
  }

  return {
    planId,
    interval,
    status: "active",
    currentPeriodStart: periodStart,
    currentPeriodEnd: periodEnd,
  };
}

export async function getBillingAccount(
  _client: AppSupabaseClient,
  userId: string,
): Promise<BillingAccountResponse> {
  const scaffold = scaffoldSubscriptions.get(userId);
  const subscription: UserSubscription = scaffold
    ? {
        planId: scaffold.planId,
        interval: scaffold.interval,
        status: scaffold.status,
        currentPeriodStart: scaffold.currentPeriodStart,
        currentPeriodEnd: scaffold.currentPeriodEnd,
      }
    : emptySubscription();

  let usage: BillingUsageSummary | null = null;
  if (subscription.planId === "hosted" && subscription.status === "active") {
    const periodStart =
      subscription.currentPeriodStart ?? startOfUtcMonth().toISOString();
    const periodEnd = subscription.currentPeriodEnd ?? endOfUtcMonth().toISOString();
    const events = scaffoldUsage.get(userId) ?? sampleUsageEvents();
    // Metering is scaffolded — always label usage as sample until live ingestion ships.
    usage = buildUsageSummary(events, periodStart, periodEnd, true);
  }

  return {
    subscription,
    usage,
    hostedProviderIds: [...HOSTED_PROVIDER_IDS],
  };
}

export function listKnownPlanIds(): BillingPlanId[] {
  return BILLING_CATALOG.map((plan) => plan.id);
}

/** True when the user may start model runs. */
export function userHasActiveSubscription(subscription: UserSubscription): boolean {
  return (
    subscription.status === "active" &&
    (subscription.planId === "byok" || subscription.planId === "hosted")
  );
}
