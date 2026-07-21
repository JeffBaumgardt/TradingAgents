/**
 * apps/api/src/services/billing-account-service.ts
 *
 * Subscription + usage account view. Persists to Postgres when available;
 * falls back to an in-process scaffold store so UI can be reviewed before Stripe.
 */

import {
  BILLING_CATALOG,
  getModelCreditMultiplier,
  isBillingInterval,
  isBillingPlanId,
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
import { ensureCreditPeriod, getPlanCreditConfig, resolveMonthlyCreditWindow } from "./credit-service.js";
import { ensureUser } from "./user-service.js";

const PROVIDER_LABELS: Record<string, string> = {
  openai: "OpenAI",
  anthropic: "Anthropic",
  google: "Google",
  xai: "xAI",
};

/** Providers available through platform keys on the hosted plan. */
export const HOSTED_PROVIDER_IDS = [
  "openai",
  "anthropic",
  "google",
  "xai",
] as const;

interface UsageEventRow {
  provider_id: string;
  model_id: string;
  tokens_in: number;
  tokens_out: number;
  billable_units: number;
  cost_source: ProviderCostSource;
}

type StoredSubscriptionStatus = "active" | "past_due" | "canceled";

interface ScaffoldSubscription {
  planId: BillingPlanId;
  interval: BillingInterval;
  status: StoredSubscriptionStatus;
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
  allowance: {
    baseAllowance: number;
    rolloverCredits: number;
    usedComputeCredits: number;
    blockedLowBalance: boolean;
  },
): BillingUsageSummary {
  const modelMap = new Map<string, UsageModelBreakdown>();
  const providerMap = new Map<string, UsageProviderBreakdown>();

  let usedComputeCreditsFromEvents = 0;
  let tokensTotal = 0;
  let selfPayTokens = 0;
  let hostedTokens = 0;

  for (const event of events) {
    const tokens = event.tokens_in + event.tokens_out;
    tokensTotal += tokens;
    usedComputeCreditsFromEvents += event.billable_units;
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

  const usedComputeCredits = isSample
    ? usedComputeCreditsFromEvents
    : allowance.usedComputeCredits;
  const totalAllowance = allowance.baseAllowance + allowance.rolloverCredits;

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

  const usedRatio = totalAllowance > 0 ? Math.min(1, usedComputeCredits / totalAllowance) : 0;

  return {
    isSample,
    periodStart,
    periodEnd,
    baseAllowanceComputeCredits: allowance.baseAllowance,
    rolloverComputeCredits: allowance.rolloverCredits,
    allowanceComputeCredits: totalAllowance,
    usedComputeCredits,
    remainingComputeCredits: Math.max(0, totalAllowance - usedComputeCredits),
    usedRatio,
    blockedLowBalance: allowance.blockedLowBalance,
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
      providerId: "openai",
      modelId: "gpt-4o-mini",
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

async function loadUsageEventsForPeriod(
  client: AppSupabaseClient,
  userId: string,
  periodStart: string,
  periodEnd: string,
): Promise<UsageEventRow[]> {
  const { data, error } = await client
    .from("usage_events")
    .select("provider_id, model_id, tokens_in, tokens_out, billable_units, cost_source")
    .eq("user_id", userId)
    .gte("created_at", periodStart)
    .lte("created_at", periodEnd);

  if (error) {
    throw new Error(`usage_events read failed: ${error.message}`);
  }

  return ((data ?? []) as UsageEventRow[]).map((row) => ({
    provider_id: row.provider_id,
    model_id: row.model_id,
    tokens_in: Number(row.tokens_in) || 0,
    tokens_out: Number(row.tokens_out) || 0,
    billable_units: Number(row.billable_units) || 0,
    cost_source: row.cost_source === "self_pay" ? "self_pay" : "hosted",
  }));
}

interface StoredSubscriptionRow {
  plan_id: string;
  interval: string;
  status: string;
  current_period_start: string;
  current_period_end: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  stripe_checkout_session_id: string | null;
}

export interface ActivatePaidSubscriptionInput {
  userId: string;
  planId: BillingPlanId;
  interval: BillingInterval;
  status?: StoredSubscriptionStatus;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  stripeCheckoutSessionId: string | null;
}

export interface SyncStripeSubscriptionInput {
  stripeSubscriptionId: string;
  status: StoredSubscriptionStatus;
  planId?: BillingPlanId | null;
  interval?: BillingInterval | null;
  currentPeriodStart?: string | null;
  currentPeriodEnd?: string | null;
  stripeCustomerId?: string | null;
}

function rowToUserSubscription(row: StoredSubscriptionRow): UserSubscription {
  const planId = isBillingPlanId(row.plan_id) ? row.plan_id : null;
  const interval = isBillingInterval(row.interval) ? row.interval : null;
  const status =
    row.status === "active" || row.status === "past_due" || row.status === "canceled"
      ? row.status
      : "none";

  return {
    planId,
    interval,
    status: planId ? status : "none",
    currentPeriodStart: row.current_period_start,
    currentPeriodEnd: row.current_period_end,
  };
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

/** Persist a paid subscription after checkout.session.completed (or equivalent). */
export async function activatePaidSubscription(
  client: AppSupabaseClient,
  input: ActivatePaidSubscriptionInput,
): Promise<UserSubscription> {
  // Ensure the Clerk user row exists before the FK upsert (webhook race).
  await ensureUser(client, input.userId);

  const status = input.status ?? "active";
  const row = {
    user_id: input.userId,
    plan_id: input.planId,
    interval: input.interval,
    status,
    current_period_start: input.currentPeriodStart,
    current_period_end: input.currentPeriodEnd,
    stripe_customer_id: input.stripeCustomerId,
    stripe_subscription_id: input.stripeSubscriptionId,
    stripe_checkout_session_id: input.stripeCheckoutSessionId,
    updated_at: new Date().toISOString(),
  };

  const { error } = await client.from("user_subscriptions").upsert(row, {
    onConflict: "user_id",
  });

  if (error) {
    // Fail closed so Stripe retries the webhook instead of granting access
    // from an in-memory map that other API instances cannot see.
    throw new Error(`user_subscriptions upsert failed: ${error.message}`);
  }

  scaffoldSubscriptions.set(input.userId, {
    planId: input.planId,
    interval: input.interval,
    status,
    currentPeriodStart: input.currentPeriodStart,
    currentPeriodEnd: input.currentPeriodEnd,
  });
  if (input.planId === "hosted" && status === "active" && !scaffoldUsage.has(input.userId)) {
    scaffoldUsage.set(input.userId, sampleUsageEvents());
  }

  return {
    planId: input.planId,
    interval: input.interval,
    status,
    currentPeriodStart: input.currentPeriodStart,
    currentPeriodEnd: input.currentPeriodEnd,
  };
}

/**
 * Sync local subscription status from Stripe lifecycle events
 * (updated / deleted / payment failed).
 */
export async function syncStripeSubscription(
  client: AppSupabaseClient,
  input: SyncStripeSubscriptionInput,
): Promise<{ updated: boolean; reason?: string }> {
  const { data, error: loadError } = await client
    .from("user_subscriptions")
    .select(
      "user_id, plan_id, interval, status, current_period_start, current_period_end, stripe_customer_id, stripe_subscription_id",
    )
    .eq("stripe_subscription_id", input.stripeSubscriptionId)
    .maybeSingle();

  if (loadError) {
    throw new Error(
      `user_subscriptions lookup failed: ${loadError.message}`,
    );
  }

  if (!data) {
    return { updated: false, reason: "subscription_not_found" };
  }

  const existing = data as StoredSubscriptionRow & { user_id: string };
  const planId =
    input.planId ??
    (isBillingPlanId(existing.plan_id) ? existing.plan_id : null);
  const interval =
    input.interval ??
    (isBillingInterval(existing.interval) ? existing.interval : null);

  if (!planId || !interval) {
    return { updated: false, reason: "invalid_stored_plan" };
  }

  const currentPeriodStart =
    input.currentPeriodStart ?? existing.current_period_start;
  const currentPeriodEnd =
    input.currentPeriodEnd ?? existing.current_period_end;
  const stripeCustomerId =
    input.stripeCustomerId ?? existing.stripe_customer_id ?? null;

  const { error } = await client.from("user_subscriptions").upsert(
    {
      user_id: existing.user_id,
      plan_id: planId,
      interval,
      status: input.status,
      current_period_start: currentPeriodStart,
      current_period_end: currentPeriodEnd,
      stripe_customer_id: stripeCustomerId,
      stripe_subscription_id: input.stripeSubscriptionId,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );

  if (error) {
    throw new Error(`user_subscriptions sync failed: ${error.message}`);
  }

  scaffoldSubscriptions.set(existing.user_id, {
    planId,
    interval,
    status: input.status,
    currentPeriodStart,
    currentPeriodEnd,
  });

  return { updated: true };
}

export async function findStripeCustomerIdForUser(
  client: AppSupabaseClient,
  userId: string,
): Promise<string | null> {
  try {
    const { data, error } = await client
      .from("user_subscriptions")
      .select("stripe_customer_id")
      .eq("user_id", userId)
      .maybeSingle();

    if (error || !data) {
      return null;
    }

    const customerId = (data as { stripe_customer_id?: string | null }).stripe_customer_id;
    return customerId?.trim() || null;
  } catch {
    return null;
  }
}

async function loadStoredSubscription(
  client: AppSupabaseClient,
  userId: string,
): Promise<UserSubscription | null> {
  const { data, error } = await client
    .from("user_subscriptions")
    .select(
      "plan_id, interval, status, current_period_start, current_period_end, stripe_customer_id, stripe_subscription_id, stripe_checkout_session_id",
    )
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(`user_subscriptions read failed: ${error.message}`);
  }

  if (!data) {
    return null;
  }

  return rowToUserSubscription(data as StoredSubscriptionRow);
}

export async function getBillingAccount(
  client: AppSupabaseClient,
  userId: string,
): Promise<BillingAccountResponse> {
  const stored = await loadStoredSubscription(client, userId);
  const scaffold = scaffoldSubscriptions.get(userId);
  const subscription: UserSubscription = stored
    ? stored
    : scaffold
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

    const scaffoldEvents = scaffoldUsage.get(userId);
    const useSample = Boolean(scaffoldEvents) && !stored;

    if (useSample && scaffoldEvents) {
      const config = await getPlanCreditConfig(client, "hosted");
      const used = scaffoldEvents.reduce((sum, event) => sum + event.billable_units, 0);
      usage = buildUsageSummary(scaffoldEvents, periodStart, periodEnd, true, {
        baseAllowance: config.monthly_credit_allowance,
        rolloverCredits: 0,
        usedComputeCredits: used,
        blockedLowBalance: false,
      });
    } else if (stored) {
      const monthly = resolveMonthlyCreditWindow({
        subscriptionPeriodStart: periodStart,
        subscriptionPeriodEnd: periodEnd,
      });
      const period = await ensureCreditPeriod(client, userId, {
        plan_id: "hosted",
        current_period_start: periodStart,
        current_period_end: periodEnd,
      });
      const events = await loadUsageEventsForPeriod(
        client,
        userId,
        monthly.periodStart,
        monthly.periodEnd,
      );
      usage = buildUsageSummary(
        events,
        period.period_start,
        period.period_end,
        false,
        {
          baseAllowance: period.base_allowance,
          rolloverCredits: period.rollover_credits,
          usedComputeCredits: period.used_credits,
          blockedLowBalance: period.blocked_low_balance,
        },
      );
    } else {
      // No stored subscription and no scaffold seed — empty live usage shell.
      const config = await getPlanCreditConfig(client, "hosted");
      usage = buildUsageSummary([], periodStart, periodEnd, false, {
        baseAllowance: config.monthly_credit_allowance,
        rolloverCredits: 0,
        usedComputeCredits: 0,
        blockedLowBalance: false,
      });
    }
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
  if (
    subscription.status !== "active" ||
    (subscription.planId !== "byok" && subscription.planId !== "hosted")
  ) {
    return false;
  }

  if (subscription.currentPeriodEnd) {
    const periodEndMs = Date.parse(subscription.currentPeriodEnd);
    if (Number.isFinite(periodEndMs) && periodEndMs < Date.now()) {
      return false;
    }
  }

  return true;
}
