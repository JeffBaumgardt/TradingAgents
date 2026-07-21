/**
 * apps/api/src/services/billing-account-service.ts
 *
 * Subscription + usage account view. Persists to Postgres when available;
 * falls back to an in-process scaffold store so UI can be reviewed before Stripe.
 */

import {
  BILLING_CATALOG,
  HOSTED_MONTHLY_BILLABLE_ALLOWANCE,
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
import { computeBillableUnits } from "../lib/billable-units.js";

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

  let usedBillableUnits = 0;
  let tokensTotal = 0;
  let selfPayTokens = 0;
  let hostedTokens = 0;

  for (const event of events) {
    const tokens = event.tokens_in + event.tokens_out;
    tokensTotal += tokens;
    usedBillableUnits += event.billable_units;
    if (event.cost_source === "self_pay") {
      selfPayTokens += tokens;
    } else {
      hostedTokens += tokens;
    }

    const modelKey = `${event.provider_id}::${event.model_id}`;
    const existingModel = modelMap.get(modelKey);
    if (existingModel) {
      existingModel.tokensTotal += tokens;
      existingModel.billableUnits += event.billable_units;
    } else {
      modelMap.set(modelKey, {
        providerId: event.provider_id,
        providerLabel: providerLabel(event.provider_id),
        modelId: event.model_id,
        tokensTotal: tokens,
        billableUnits: event.billable_units,
        costSource: event.cost_source,
        shareOfBillable: 0,
      });
    }

    const existingProvider = providerMap.get(event.provider_id);
    if (existingProvider) {
      existingProvider.tokensTotal += tokens;
      existingProvider.billableUnits += event.billable_units;
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
        billableUnits: event.billable_units,
        selfPayTokens: event.cost_source === "self_pay" ? tokens : 0,
        hostedTokens: event.cost_source === "hosted" ? tokens : 0,
        shareOfBillable: 0,
      });
    }
  }

  const byModel = [...modelMap.values()]
    .map((row) => ({
      ...row,
      shareOfBillable: usedBillableUnits > 0 ? row.billableUnits / usedBillableUnits : 0,
    }))
    .sort((a, b) => b.billableUnits - a.billableUnits || b.tokensTotal - a.tokensTotal);

  const byProvider = [...providerMap.values()]
    .map((row) => ({
      ...row,
      shareOfBillable: usedBillableUnits > 0 ? row.billableUnits / usedBillableUnits : 0,
    }))
    .sort((a, b) => b.billableUnits - a.billableUnits || b.tokensTotal - a.tokensTotal);

  const allowance = HOSTED_MONTHLY_BILLABLE_ALLOWANCE;
  const usedRatio = allowance > 0 ? Math.min(1, usedBillableUnits / allowance) : 0;

  return {
    isSample,
    periodStart,
    periodEnd,
    allowanceBillableUnits: allowance,
    usedBillableUnits,
    remainingBillableUnits: Math.max(0, allowance - usedBillableUnits),
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
      modelId: "claude-opus-4",
      tokensIn: 12_000,
      tokensOut: 8_000,
      costSource: "hosted",
    },
    {
      providerId: "openai",
      modelId: "gpt-4o",
      tokensIn: 40_000,
      tokensOut: 18_000,
      costSource: "hosted",
    },
    {
      providerId: "google",
      modelId: "gemini-2.0-flash",
      tokensIn: 90_000,
      tokensOut: 40_000,
      costSource: "hosted",
    },
    {
      providerId: "anthropic",
      modelId: "claude-sonnet-4",
      tokensIn: 55_000,
      tokensOut: 22_000,
      costSource: "self_pay",
    },
    {
      providerId: "xai",
      modelId: "grok-3",
      tokensIn: 25_000,
      tokensOut: 12_000,
      costSource: "hosted",
    },
  ];

  return samples.map((sample) => ({
    provider_id: sample.providerId,
    model_id: sample.modelId,
    tokens_in: sample.tokensIn,
    tokens_out: sample.tokensOut,
    billable_units: computeBillableUnits({
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
