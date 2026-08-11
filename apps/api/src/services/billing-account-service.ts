/**
 * apps/api/src/services/billing-account-service.ts
 *
 * Subscription + usage account view. Persists to Postgres when available;
 * falls back to an in-process scaffold store so UI can be reviewed before Stripe.
 */

import {
  AGENTS_MODEL_DISPLAY_NAME,
  AGENTS_MODEL_ID,
  AGENTS_MODEL_PROVIDER_ID,
  BILLING_CATALOG,
  getModelCreditMultiplier,
  isBillingInterval,
  isBillingPlanId,
  planFeaturesFor,
  TRIAL_DAYS,
  type BillingAccountResponse,
  type BillingInterval,
  type BillingPlanId,
  type BillingUsageSummary,
  type CancelSubscriptionResponse,
  type ProviderCostSource,
  type UsageModelBreakdown,
  type UsageProviderBreakdown,
  type UserSubscription,
} from "@tradingagents/api-types";
import type { AppSupabaseClient } from "@tradingagents/supabase";
import { computeCredits } from "../lib/billable-units.js";
import { isBillingScaffoldEnabled } from "../lib/billing-scaffold.js";
import { getStripeClient, isStripeConfigured } from "../lib/stripe.js";
import { ensureCreditPeriod, getPlanCreditConfig, resolveMonthlyCreditWindow } from "./credit-service.js";
import { ensureUser } from "./user-service.js";

export class BillingAccountError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "BillingAccountError";
    this.status = status;
  }
}

const PROVIDER_LABELS: Record<string, string> = {
  anthropic: "Anthropic",
};

/** Providers available through platform keys (Anthropic only). */
export const HOSTED_PROVIDER_IDS = [AGENTS_MODEL_PROVIDER_ID] as const;

interface UsageEventRow {
  provider_id: string;
  model_id: string;
  tokens_in: number;
  tokens_out: number;
  billable_units: number;
  cost_source: ProviderCostSource;
}

type StoredSubscriptionStatus =
  | "active"
  | "trialing"
  | "past_due"
  | "canceled"
  | "expired";

function mapStripeStatusToStored(
  status: string,
): StoredSubscriptionStatus | null {
  switch (status) {
    case "active":
      return "active";
    case "trialing":
      return "trialing";
    case "past_due":
      return "past_due";
    case "canceled":
    case "unpaid":
    case "incomplete_expired":
    case "paused":
      return "canceled";
    default:
      return null;
  }
}

function isCancellableSubscriptionStatus(
  status: string | undefined,
): status is "active" | "past_due" | "trialing" {
  return status === "active" || status === "past_due" || status === "trialing";
}

interface ScaffoldSubscription {
  planId: BillingPlanId;
  interval: BillingInterval;
  status: StoredSubscriptionStatus;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
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

function addDaysIso(startIso: string, days: number): string {
  const start = new Date(startIso);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + days);
  return end.toISOString();
}

function emptySubscription(): UserSubscription {
  return {
    planId: null,
    interval: null,
    status: "none",
    currentPeriodStart: null,
    currentPeriodEnd: null,
    cancelAtPeriodEnd: false,
    isTrial: false,
    trialEndsAt: null,
  };
}

function enrichSubscription(sub: UserSubscription): UserSubscription {
  const isTrial = sub.status === "trialing";
  return {
    ...sub,
    isTrial,
    trialEndsAt: isTrial ? sub.currentPeriodEnd : null,
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
      providerId: AGENTS_MODEL_PROVIDER_ID,
      modelId: AGENTS_MODEL_ID,
      tokensIn: 180_000,
      tokensOut: 90_000,
      costSource: "hosted",
    },
    {
      providerId: AGENTS_MODEL_PROVIDER_ID,
      modelId: AGENTS_MODEL_ID,
      tokensIn: 40_000,
      tokensOut: 20_000,
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
  cancel_at_period_end: boolean;
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
  cancelAtPeriodEnd?: boolean | null;
}

function normalizePlanId(raw: string): BillingPlanId | null {
  if (isBillingPlanId(raw)) {
    return raw;
  }
  if (raw === "hosted") {
    return "pro";
  }
  if (raw === "byok") {
    return "standard";
  }
  return null;
}

function rowToUserSubscription(row: StoredSubscriptionRow): UserSubscription {
  const planId = normalizePlanId(row.plan_id);
  const interval = isBillingInterval(row.interval) ? row.interval : null;
  let status: UserSubscription["status"] =
    row.status === "active" ||
    row.status === "trialing" ||
    row.status === "past_due" ||
    row.status === "canceled" ||
    row.status === "expired"
      ? row.status
      : "none";

  if (
    status === "trialing" &&
    row.current_period_end &&
    Number.isFinite(Date.parse(row.current_period_end)) &&
    Date.parse(row.current_period_end) < Date.now()
  ) {
    status = "expired";
  }

  return enrichSubscription({
    planId,
    interval,
    status: planId ? status : "none",
    currentPeriodStart: row.current_period_start,
    currentPeriodEnd: row.current_period_end,
    cancelAtPeriodEnd: Boolean(row.cancel_at_period_end),
  });
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
    cancelAtPeriodEnd: false,
  };
  scaffoldSubscriptions.set(userId, subscription);

  if (!scaffoldUsage.has(userId)) {
    scaffoldUsage.set(userId, sampleUsageEvents());
  }

  return enrichSubscription({
    planId,
    interval,
    status: "active",
    currentPeriodStart: periodStart,
    currentPeriodEnd: periodEnd,
    cancelAtPeriodEnd: false,
  });
}

/**
 * Start a no-card free trial. One trial per account: rejects if any
 * subscription row (or in-memory scaffold) already exists.
 */
export async function startTrialSubscription(
  client: AppSupabaseClient,
  userId: string,
  planId: BillingPlanId,
): Promise<UserSubscription> {
  await ensureUser(client, userId);

  const existing = await loadStoredSubscription(client, userId);
  const scaffold = scaffoldSubscriptions.get(userId);
  if (existing || scaffold) {
    throw new BillingAccountError(
      userHasActiveSubscription(
        existing ??
          enrichSubscription({
            planId: scaffold!.planId,
            interval: scaffold!.interval,
            status: scaffold!.status,
            currentPeriodStart: scaffold!.currentPeriodStart,
            currentPeriodEnd: scaffold!.currentPeriodEnd,
            cancelAtPeriodEnd: scaffold!.cancelAtPeriodEnd,
          }),
      )
        ? "An active plan or trial is already in progress"
        : "A free trial has already been used for this account",
      400,
    );
  }

  const periodStart = new Date().toISOString();
  const periodEnd = addDaysIso(periodStart, TRIAL_DAYS);

  const row = {
    user_id: userId,
    plan_id: planId,
    interval: "monthly" as const,
    status: "trialing" as const,
    current_period_start: periodStart,
    current_period_end: periodEnd,
    cancel_at_period_end: false,
    stripe_customer_id: null,
    stripe_subscription_id: null,
    stripe_checkout_session_id: null,
    updated_at: new Date().toISOString(),
  };

  const { error } = await client.from("user_subscriptions").upsert(row, {
    onConflict: "user_id",
  });

  if (error) {
    const sub: ScaffoldSubscription = {
      planId,
      interval: "monthly",
      status: "trialing",
      currentPeriodStart: periodStart,
      currentPeriodEnd: periodEnd,
      cancelAtPeriodEnd: false,
    };
    scaffoldSubscriptions.set(userId, sub);
    if (!scaffoldUsage.has(userId)) {
      scaffoldUsage.set(userId, sampleUsageEvents());
    }
    return enrichSubscription({
      planId,
      interval: "monthly",
      status: "trialing",
      currentPeriodStart: periodStart,
      currentPeriodEnd: periodEnd,
      cancelAtPeriodEnd: false,
    });
  }

  scaffoldSubscriptions.set(userId, {
    planId,
    interval: "monthly",
    status: "trialing",
    currentPeriodStart: periodStart,
    currentPeriodEnd: periodEnd,
    cancelAtPeriodEnd: false,
  });

  try {
    await ensureCreditPeriod(client, userId, {
      plan_id: planId,
      current_period_start: periodStart,
      current_period_end: periodEnd,
    });
  } catch {
    // Credit tables may be empty in unit tests; subscription still starts.
  }

  return enrichSubscription({
    planId,
    interval: "monthly",
    status: "trialing",
    currentPeriodStart: periodStart,
    currentPeriodEnd: periodEnd,
    cancelAtPeriodEnd: false,
  });
}

/** Mark expired trials in the database when period end has passed. */
export async function expireStaleTrials(
  client: AppSupabaseClient,
  userId: string,
): Promise<void> {
  const { data, error } = await client
    .from("user_subscriptions")
    .select("status, current_period_end")
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !data) {
    const scaffold = scaffoldSubscriptions.get(userId);
    if (
      scaffold?.status === "trialing" &&
      Date.parse(scaffold.currentPeriodEnd) < Date.now()
    ) {
      scaffold.status = "expired";
      scaffoldSubscriptions.set(userId, scaffold);
    }
    return;
  }

  const status = (data as { status: string; current_period_end: string }).status;
  const periodEnd = (data as { current_period_end: string }).current_period_end;
  if (status !== "trialing") {
    return;
  }
  if (!periodEnd || Date.parse(periodEnd) >= Date.now()) {
    return;
  }

  await client
    .from("user_subscriptions")
    .update({ status: "expired", updated_at: new Date().toISOString() })
    .eq("user_id", userId);

  const scaffold = scaffoldSubscriptions.get(userId);
  if (scaffold) {
    scaffold.status = "expired";
    scaffoldSubscriptions.set(userId, scaffold);
  }
}

/** Persist a paid subscription after checkout.session.completed (or equivalent). */
export async function activatePaidSubscription(
  client: AppSupabaseClient,
  input: ActivatePaidSubscriptionInput,
): Promise<UserSubscription> {
  await ensureUser(client, input.userId);

  const status = input.status ?? "active";
  const row = {
    user_id: input.userId,
    plan_id: input.planId,
    interval: input.interval,
    status,
    current_period_start: input.currentPeriodStart,
    current_period_end: input.currentPeriodEnd,
    cancel_at_period_end: false,
    stripe_customer_id: input.stripeCustomerId,
    stripe_subscription_id: input.stripeSubscriptionId,
    stripe_checkout_session_id: input.stripeCheckoutSessionId,
    updated_at: new Date().toISOString(),
  };

  const { error } = await client.from("user_subscriptions").upsert(row, {
    onConflict: "user_id",
  });

  if (error) {
    throw new Error(`user_subscriptions upsert failed: ${error.message}`);
  }

  scaffoldSubscriptions.set(input.userId, {
    planId: input.planId,
    interval: input.interval,
    status,
    currentPeriodStart: input.currentPeriodStart,
    currentPeriodEnd: input.currentPeriodEnd,
    cancelAtPeriodEnd: false,
  });
  if (status === "active" && !scaffoldUsage.has(input.userId)) {
    scaffoldUsage.set(input.userId, sampleUsageEvents());
  }

  return enrichSubscription({
    planId: input.planId,
    interval: input.interval,
    status,
    currentPeriodStart: input.currentPeriodStart,
    currentPeriodEnd: input.currentPeriodEnd,
    cancelAtPeriodEnd: false,
  });
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
      "user_id, plan_id, interval, status, current_period_start, current_period_end, cancel_at_period_end, stripe_customer_id, stripe_subscription_id",
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
    normalizePlanId(existing.plan_id);
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
  const cancelAtPeriodEnd =
    input.cancelAtPeriodEnd ?? Boolean(existing.cancel_at_period_end);

  // Local free-trial uses status=trialing without Stripe; Stripe-paid maps trialing -> active access.
  const status: StoredSubscriptionStatus =
    input.status === "trialing" ? "active" : input.status;

  const { error } = await client.from("user_subscriptions").upsert(
    {
      user_id: existing.user_id,
      plan_id: planId,
      interval,
      status,
      current_period_start: currentPeriodStart,
      current_period_end: currentPeriodEnd,
      cancel_at_period_end: cancelAtPeriodEnd,
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
    status,
    currentPeriodStart,
    currentPeriodEnd,
    cancelAtPeriodEnd,
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
      "plan_id, interval, status, current_period_start, current_period_end, cancel_at_period_end, stripe_customer_id, stripe_subscription_id, stripe_checkout_session_id",
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

function planHasCreditMeter(planId: BillingPlanId | null): planId is BillingPlanId {
  return planId === "standard" || planId === "pro";
}

export async function getBillingAccount(
  client: AppSupabaseClient,
  userId: string,
): Promise<BillingAccountResponse> {
  await expireStaleTrials(client, userId);

  const stored = await loadStoredSubscription(client, userId);
  const scaffold = scaffoldSubscriptions.get(userId);
  const subscription: UserSubscription = stored
    ? stored
    : scaffold
      ? enrichSubscription({
          planId: scaffold.planId,
          interval: scaffold.interval,
          status:
            scaffold.status === "trialing" &&
            Date.parse(scaffold.currentPeriodEnd) < Date.now()
              ? "expired"
              : scaffold.status,
          currentPeriodStart: scaffold.currentPeriodStart,
          currentPeriodEnd: scaffold.currentPeriodEnd,
          cancelAtPeriodEnd: scaffold.cancelAtPeriodEnd,
        })
      : emptySubscription();

  let usage: BillingUsageSummary | null = null;
  if (
    planHasCreditMeter(subscription.planId) &&
    (subscription.status === "active" || subscription.status === "trialing")
  ) {
    const periodStart =
      subscription.currentPeriodStart ?? startOfUtcMonth().toISOString();
    const periodEnd = subscription.currentPeriodEnd ?? endOfUtcMonth().toISOString();
    const planId = subscription.planId;

    const scaffoldEvents = scaffoldUsage.get(userId);
    const useSample = Boolean(scaffoldEvents) && !stored;

    if (useSample && scaffoldEvents) {
      const config = await getPlanCreditConfig(client, planId);
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
        plan_id: planId,
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
      const config = await getPlanCreditConfig(client, planId);
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
    features: planFeaturesFor(subscription.planId),
    agentsModelDisplayName: AGENTS_MODEL_DISPLAY_NAME,
  };
}

export function listKnownPlanIds(): BillingPlanId[] {
  return BILLING_CATALOG.map((plan) => plan.id);
}

/** True when the user may start model runs. */
export function userHasActiveSubscription(subscription: UserSubscription): boolean {
  if (
    (subscription.status !== "active" && subscription.status !== "trialing") ||
    (subscription.planId !== "standard" && subscription.planId !== "pro")
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

/** True when the account may share reports by public link (active Pro only). */
export function userCanShareReports(subscription: UserSubscription): boolean {
  return userHasActiveSubscription(subscription) && subscription.planId === "pro";
}

/**
 * Schedule cancellation at the end of the current billing period.
 * Keeps status active until period end so paid time is honored.
 * Does not delete sessions or invalidate shared run links.
 */
export async function cancelSubscriptionAtPeriodEnd(
  client: AppSupabaseClient,
  userId: string,
): Promise<CancelSubscriptionResponse> {
  const { data, error } = await client
    .from("user_subscriptions")
    .select(
      "user_id, plan_id, interval, status, current_period_start, current_period_end, cancel_at_period_end, stripe_customer_id, stripe_subscription_id, stripe_checkout_session_id",
    )
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(`user_subscriptions read failed: ${error.message}`);
  }

  const scaffold = scaffoldSubscriptions.get(userId);
  const row = data as (StoredSubscriptionRow & { user_id: string }) | null;

  if (!row && !scaffold) {
    throw new BillingAccountError("No active subscription to cancel", 400);
  }

  const status = row?.status ?? scaffold?.status;
  if (!isCancellableSubscriptionStatus(status)) {
    throw new BillingAccountError("No active subscription to cancel", 400);
  }

  if (status === "trialing" && !row?.stripe_subscription_id) {
    if (row) {
      await client
        .from("user_subscriptions")
        .update({
          status: "canceled",
          cancel_at_period_end: true,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", userId);
    }
    if (scaffold) {
      scaffold.status = "canceled";
      scaffold.cancelAtPeriodEnd = true;
      scaffoldSubscriptions.set(userId, scaffold);
    }
    const account = await getBillingAccount(client, userId);
    return {
      subscription: account.subscription,
      accessEndsAt: account.subscription.currentPeriodEnd,
    };
  }

  const alreadyScheduled =
    Boolean(row?.cancel_at_period_end) || Boolean(scaffold?.cancelAtPeriodEnd);
  if (alreadyScheduled) {
    const account = await getBillingAccount(client, userId);
    return {
      subscription: account.subscription,
      accessEndsAt: account.subscription.currentPeriodEnd,
    };
  }

  const stripeSubscriptionId = row?.stripe_subscription_id?.trim() || null;

  if (stripeSubscriptionId && isStripeConfigured()) {
    let stripeSubscription;
    try {
      stripeSubscription = await getStripeClient().subscriptions.update(
        stripeSubscriptionId,
        { cancel_at_period_end: true },
      );
    } catch (caught) {
      throw new BillingAccountError(
        `Stripe could not schedule cancellation: ${
          caught instanceof Error ? caught.message : String(caught)
        }`,
        502,
      );
    }

    const mappedStatus =
      mapStripeStatusToStored(stripeSubscription.status) ?? status;
    const item = stripeSubscription.items?.data?.[0];
    const periodStart =
      item?.current_period_start != null
        ? new Date(item.current_period_start * 1000).toISOString()
        : row?.current_period_start ?? scaffold?.currentPeriodStart ?? null;
    const periodEnd =
      item?.current_period_end != null
        ? new Date(item.current_period_end * 1000).toISOString()
        : row?.current_period_end ?? scaffold?.currentPeriodEnd ?? null;

    const syncResult = await syncStripeSubscription(client, {
      stripeSubscriptionId,
      status: mappedStatus === "trialing" ? "active" : mappedStatus,
      cancelAtPeriodEnd: true,
      currentPeriodStart: periodStart,
      currentPeriodEnd: periodEnd,
      stripeCustomerId:
        typeof stripeSubscription.customer === "string"
          ? stripeSubscription.customer
          : stripeSubscription.customer?.id ?? row?.stripe_customer_id ?? null,
    });

    if (!syncResult.updated) {
      throw new BillingAccountError(
        `Subscription was updated in Stripe but local sync failed (${syncResult.reason ?? "unknown"})`,
        502,
      );
    }
  } else if (row) {
    if (isStripeConfigured() && !isBillingScaffoldEnabled()) {
      throw new BillingAccountError(
        "Subscription is missing a Stripe id and cannot be canceled",
        400,
      );
    }

    const { error: updateError } = await client.from("user_subscriptions").upsert(
      {
        user_id: userId,
        plan_id: row.plan_id,
        interval: row.interval,
        status: row.status,
        current_period_start: row.current_period_start,
        current_period_end: row.current_period_end,
        cancel_at_period_end: true,
        stripe_customer_id: row.stripe_customer_id,
        stripe_subscription_id: row.stripe_subscription_id,
        stripe_checkout_session_id: row.stripe_checkout_session_id,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );

    if (updateError) {
      throw new Error(
        `user_subscriptions cancel update failed: ${updateError.message}`,
      );
    }

    const planId = normalizePlanId(row.plan_id);
    if (planId && isBillingInterval(row.interval)) {
      scaffoldSubscriptions.set(userId, {
        planId,
        interval: row.interval,
        status: row.status as StoredSubscriptionStatus,
        currentPeriodStart: row.current_period_start,
        currentPeriodEnd: row.current_period_end,
        cancelAtPeriodEnd: true,
      });
    }
  } else if (scaffold) {
    scaffold.cancelAtPeriodEnd = true;
    scaffoldSubscriptions.set(userId, scaffold);
  } else {
    throw new BillingAccountError("No active subscription to cancel", 400);
  }

  const account = await getBillingAccount(client, userId);
  return {
    subscription: account.subscription,
    accessEndsAt: account.subscription.currentPeriodEnd,
  };
}
