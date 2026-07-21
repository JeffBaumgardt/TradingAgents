/**
 * apps/api/src/services/credit-service.ts
 *
 * Hosted compute-credit periods, rollover (prior month only), pre-flight
 * gating, and live metering from SSE stats deltas.
 */

import {
  HOSTED_MONTHLY_COMPUTE_CREDIT_ALLOWANCE,
  getModelCreditMultiplier,
  type CreateSessionRequest,
  type ProviderCostSource,
} from "@tradingagents/api-types";
import type {
  AppSupabaseClient,
  PlanCreditConfigRow,
  SessionUsageCursorRow,
  UserCreditPeriodRow,
  UserSubscriptionRow,
} from "@tradingagents/supabase";

const DEFAULT_ESTIMATED_TOKENS: Record<string, number> = {
  "1": 80_000,
  "3": 250_000,
  "5": 500_000,
};

export interface CreditBalance {
  period: UserCreditPeriodRow;
  totalAllowance: number;
  remaining: number;
  usedRatio: number;
  blockRatio: number;
  warnRatio: number;
}

export interface CreditGateResult {
  allowed: boolean;
  code?:
    | "credits_blocked"
    | "credits_insufficient"
    | "credits_period_missing"
    | "not_hosted";
  message?: string;
  balance?: CreditBalance;
  estimatedCredits?: number;
}

export interface MeterStatsResult {
  chargedCredits: number;
  sessionCredits: number;
  remaining: number | null;
  totalAllowance: number | null;
  usedRatio: number | null;
  exhausted: boolean;
  shouldWarn: boolean;
  warnMessage?: string;
  costSource: ProviderCostSource;
}

function asNumber(value: unknown, fallback = 0): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function periodTotal(period: UserCreditPeriodRow): number {
  return period.base_allowance + period.rollover_credits;
}

function remainingOf(period: UserCreditPeriodRow): number {
  return Math.max(0, periodTotal(period) - period.used_credits);
}

function usedRatioOf(period: UserCreditPeriodRow): number {
  const total = periodTotal(period);
  if (total <= 0) {
    return 1;
  }
  return Math.min(1, period.used_credits / total);
}

export async function getPlanCreditConfig(
  client: AppSupabaseClient,
  planId: string,
): Promise<PlanCreditConfigRow> {
  const { data, error } = await client
    .from("plan_credit_configs")
    .select("*")
    .eq("plan_id", planId)
    .maybeSingle();

  if (error) {
    throw new Error(`plan_credit_configs read failed: ${error.message}`);
  }

  if (data) {
    const row = data as PlanCreditConfigRow;
    return {
      ...row,
      monthly_credit_allowance: asNumber(row.monthly_credit_allowance),
      low_balance_block_ratio: asNumber(row.low_balance_block_ratio, 0.03),
      low_balance_warn_ratio: asNumber(row.low_balance_warn_ratio, 0.1),
      max_rollover_periods: asNumber(row.max_rollover_periods, 1),
      reference_output_usd_per_1m: asNumber(row.reference_output_usd_per_1m, 0.266667),
      estimated_tokens_by_depth:
        row.estimated_tokens_by_depth && typeof row.estimated_tokens_by_depth === "object"
          ? row.estimated_tokens_by_depth
          : DEFAULT_ESTIMATED_TOKENS,
    };
  }

  // Fallback when migration not applied yet.
  return {
    plan_id: planId,
    monthly_credit_allowance:
      planId === "hosted" ? HOSTED_MONTHLY_COMPUTE_CREDIT_ALLOWANCE : 0,
    low_balance_block_ratio: 0.03,
    low_balance_warn_ratio: 0.1,
    max_rollover_periods: planId === "hosted" ? 1 : 0,
    estimated_tokens_by_depth: DEFAULT_ESTIMATED_TOKENS,
    reference_output_usd_per_1m: 0.266667,
    updated_at: new Date().toISOString(),
  };
}

async function loadMultiplier(
  client: AppSupabaseClient,
  providerId: string,
  modelId: string,
): Promise<number> {
  const { data, error } = await client
    .from("model_credit_multipliers")
    .select("credit_multiplier")
    .eq("provider_id", providerId.toLowerCase())
    .eq("model_id", modelId)
    .eq("is_active", true)
    .maybeSingle();

  if (!error && data) {
    const multiplier = asNumber(
      (data as { credit_multiplier?: number }).credit_multiplier,
      NaN,
    );
    if (Number.isFinite(multiplier) && multiplier > 0) {
      return multiplier;
    }
  }

  return getModelCreditMultiplier(providerId, modelId);
}

export async function resolveCreditMultiplier(
  client: AppSupabaseClient,
  providerId: string,
  modelId: string,
): Promise<number> {
  return loadMultiplier(client, providerId, modelId);
}

/**
 * Rollover = unused *base* allowance from the immediately previous period only.
 * Prior rollover is intentionally excluded so balances cannot stack across months.
 */
export function computeRolloverCredits(
  previous: UserCreditPeriodRow | null,
  maxRolloverPeriods: number,
): number {
  if (!previous || maxRolloverPeriods < 1) {
    return 0;
  }
  return Math.max(0, previous.base_allowance - previous.used_credits);
}

async function findPreviousPeriod(
  client: AppSupabaseClient,
  userId: string,
  periodStartIso: string,
): Promise<UserCreditPeriodRow | null> {
  const { data, error } = await client
    .from("user_credit_periods")
    .select("*")
    .eq("user_id", userId)
    .lt("period_start", periodStartIso)
    .order("period_start", { ascending: false })
    .limit(1);

  if (error) {
    throw new Error(`user_credit_periods previous read failed: ${error.message}`);
  }

  const rows = (data ?? []) as UserCreditPeriodRow[];
  return rows[0] ?? null;
}

export async function ensureCreditPeriod(
  client: AppSupabaseClient,
  userId: string,
  subscription: Pick<
    UserSubscriptionRow,
    "plan_id" | "current_period_start" | "current_period_end"
  >,
): Promise<UserCreditPeriodRow> {
  const periodStart = subscription.current_period_start;
  const periodEnd = subscription.current_period_end;

  const { data: existing, error: loadError } = await client
    .from("user_credit_periods")
    .select("*")
    .eq("user_id", userId)
    .eq("period_start", periodStart)
    .maybeSingle();

  if (loadError) {
    throw new Error(`user_credit_periods read failed: ${loadError.message}`);
  }
  if (existing) {
    return existing as UserCreditPeriodRow;
  }

  const config = await getPlanCreditConfig(client, subscription.plan_id);
  const previous = await findPreviousPeriod(client, userId, periodStart);
  const rollover = computeRolloverCredits(previous, config.max_rollover_periods);
  const now = new Date().toISOString();

  const insertRow = {
    user_id: userId,
    period_start: periodStart,
    period_end: periodEnd,
    base_allowance: config.monthly_credit_allowance,
    rollover_credits: rollover,
    used_credits: 0,
    blocked_low_balance: false,
    created_at: now,
    updated_at: now,
  };

  const { data: inserted, error: insertError } = await client
    .from("user_credit_periods")
    .insert(insertRow)
    .select("*")
    .maybeSingle();

  if (insertError) {
    // Unique race: re-read.
    const { data: raced, error: raceError } = await client
      .from("user_credit_periods")
      .select("*")
      .eq("user_id", userId)
      .eq("period_start", periodStart)
      .maybeSingle();
    if (raceError || !raced) {
      throw new Error(`user_credit_periods insert failed: ${insertError.message}`);
    }
    return raced as UserCreditPeriodRow;
  }

  if (inserted) {
    return inserted as UserCreditPeriodRow;
  }

  // In-memory client may not return inserted rows from select-after-insert.
  const { data: loaded } = await client
    .from("user_credit_periods")
    .select("*")
    .eq("user_id", userId)
    .eq("period_start", periodStart)
    .maybeSingle();

  if (!loaded) {
    throw new Error("user_credit_periods insert succeeded but row is missing");
  }
  return loaded as UserCreditPeriodRow;
}

export async function getCreditBalance(
  client: AppSupabaseClient,
  userId: string,
  subscription: Pick<
    UserSubscriptionRow,
    "plan_id" | "current_period_start" | "current_period_end"
  >,
): Promise<CreditBalance> {
  const period = await ensureCreditPeriod(client, userId, subscription);
  const config = await getPlanCreditConfig(client, subscription.plan_id);
  return {
    period,
    totalAllowance: periodTotal(period),
    remaining: remainingOf(period),
    usedRatio: usedRatioOf(period),
    blockRatio: config.low_balance_block_ratio,
    warnRatio: config.low_balance_warn_ratio,
  };
}

export async function estimateRunCredits(
  client: AppSupabaseClient,
  body: CreateSessionRequest,
  costSource: ProviderCostSource,
): Promise<number> {
  if (costSource === "self_pay") {
    return 0;
  }

  const config = await getPlanCreditConfig(client, "hosted");
  const depthKey = String(body.researchDepth);
  const tokensByDepth = config.estimated_tokens_by_depth ?? DEFAULT_ESTIMATED_TOKENS;
  const baseTokens = asNumber(tokensByDepth[depthKey], DEFAULT_ESTIMATED_TOKENS[depthKey] ?? 250_000);
  const analystFactor = Math.max(1, (body.analysts?.length ?? 4) / 4);

  const quickMult = await loadMultiplier(client, body.llmProvider, body.quickThinkLlm);
  const deepMult = await loadMultiplier(client, body.llmProvider, body.deepThinkLlm);
  // Weight deep models higher — research/risk rounds dominate cost.
  const blended = quickMult * 0.35 + deepMult * 0.65;

  return Math.round(baseTokens * analystFactor * blended);
}

export async function assertHostedCreditsForNewRun(
  client: AppSupabaseClient,
  userId: string,
  subscription: Pick<
    UserSubscriptionRow,
    "plan_id" | "current_period_start" | "current_period_end"
  >,
  body: CreateSessionRequest,
  costSource: ProviderCostSource,
): Promise<CreditGateResult> {
  if (subscription.plan_id !== "hosted" || costSource !== "hosted") {
    return { allowed: true, code: "not_hosted" };
  }

  const balance = await getCreditBalance(client, userId, subscription);
  const estimatedCredits = await estimateRunCredits(client, body, costSource);
  const { period, remaining, totalAllowance, blockRatio } = balance;

  if (period.blocked_low_balance) {
    return {
      allowed: false,
      code: "credits_blocked",
      message:
        "Your hosted compute credits are too low to start another run this billing period. " +
        "Usage resets at the start of your next period (unspent credits from this month may roll over once).",
      balance,
      estimatedCredits,
    };
  }

  const blockFloor = Math.ceil(totalAllowance * blockRatio);
  if (remaining < blockFloor || remaining < estimatedCredits) {
    await markPeriodBlocked(client, period.id);
    return {
      allowed: false,
      code: "credits_insufficient",
      message:
        remaining < estimatedCredits
          ? `This run is estimated to use about ${estimatedCredits.toLocaleString()} compute credits, but you only have ${remaining.toLocaleString()} remaining. New hosted runs are blocked for the rest of this billing period.`
          : `You have less than ${Math.round(blockRatio * 100)}% of your compute credit allowance remaining (${remaining.toLocaleString()} of ${totalAllowance.toLocaleString()}). New hosted runs are blocked for the rest of this billing period.`,
      balance,
      estimatedCredits,
    };
  }

  return { allowed: true, balance, estimatedCredits };
}

async function markPeriodBlocked(
  client: AppSupabaseClient,
  periodId: number,
): Promise<void> {
  const { error } = await client
    .from("user_credit_periods")
    .update({
      blocked_low_balance: true,
      updated_at: new Date().toISOString(),
    })
    .eq("id", periodId);

  if (error) {
    throw new Error(`user_credit_periods block update failed: ${error.message}`);
  }
}

async function chargeCredits(
  client: AppSupabaseClient,
  periodId: number,
  credits: number,
): Promise<{
  allowed: boolean;
  used_credits: number;
  remaining_credits: number;
  total_allowance: number;
  blocked_low_balance: boolean;
}> {
  if (credits <= 0) {
    const { data, error } = await client
      .from("user_credit_periods")
      .select("*")
      .eq("id", periodId)
      .maybeSingle();
    if (error || !data) {
      throw new Error(error?.message ?? "credit period missing");
    }
    const period = data as UserCreditPeriodRow;
    return {
      allowed: true,
      used_credits: period.used_credits,
      remaining_credits: remainingOf(period),
      total_allowance: periodTotal(period),
      blocked_low_balance: period.blocked_low_balance,
    };
  }

  const { data: rpcData, error: rpcError } = await client.rpc("charge_user_credits", {
    p_period_id: periodId,
    p_credits: credits,
  });

  if (!rpcError && Array.isArray(rpcData) && rpcData[0]) {
    const row = rpcData[0] as {
      allowed: boolean;
      used_credits: number;
      remaining_credits: number;
      total_allowance: number;
      blocked_low_balance: boolean;
    };
    return {
      allowed: Boolean(row.allowed),
      used_credits: asNumber(row.used_credits),
      remaining_credits: asNumber(row.remaining_credits),
      total_allowance: asNumber(row.total_allowance),
      blocked_low_balance: Boolean(row.blocked_low_balance),
    };
  }

  // Fallback for in-memory tests / environments without the SQL function.
  const { data, error } = await client
    .from("user_credit_periods")
    .select("*")
    .eq("id", periodId)
    .maybeSingle();
  if (error || !data) {
    throw new Error(error?.message ?? rpcError?.message ?? "credit period missing");
  }

  const period = data as UserCreditPeriodRow;
  const total = periodTotal(period);
  const nextUsed = period.used_credits + credits;
  if (nextUsed > total) {
    return {
      allowed: false,
      used_credits: period.used_credits,
      remaining_credits: remainingOf(period),
      total_allowance: total,
      blocked_low_balance: period.blocked_low_balance,
    };
  }

  const { error: updateError } = await client
    .from("user_credit_periods")
    .update({
      used_credits: nextUsed,
      updated_at: new Date().toISOString(),
    })
    .eq("id", periodId);

  if (updateError) {
    throw new Error(`credit charge update failed: ${updateError.message}`);
  }

  return {
    allowed: true,
    used_credits: nextUsed,
    remaining_credits: Math.max(0, total - nextUsed),
    total_allowance: total,
    blocked_low_balance: period.blocked_low_balance,
  };
}

export async function initSessionUsageCursor(
  client: AppSupabaseClient,
  input: {
    sessionId: string;
    userId: string;
    providerId: string;
    quickModelId: string;
    deepModelId: string;
    costSource: ProviderCostSource;
  },
): Promise<void> {
  const now = new Date().toISOString();
  const { error } = await client.from("session_usage_cursors").upsert(
    {
      session_id: input.sessionId,
      user_id: input.userId,
      provider_id: input.providerId.toLowerCase(),
      quick_model_id: input.quickModelId,
      deep_model_id: input.deepModelId,
      cost_source: input.costSource,
      last_tokens_in: 0,
      last_tokens_out: 0,
      credits_charged: 0,
      low_credit_warned: false,
      created_at: now,
      updated_at: now,
    },
    { onConflict: "session_id" },
  );

  if (error) {
    throw new Error(`session_usage_cursors upsert failed: ${error.message}`);
  }
}

/**
 * Meter a cumulative stats snapshot. Charges only the token delta since the
 * last cursor so repeated SSE frames do not double-bill.
 */
export async function meterSessionStats(
  client: AppSupabaseClient,
  input: {
    sessionId: string;
    userId: string;
    tokensIn: number;
    tokensOut: number;
    subscription: Pick<
      UserSubscriptionRow,
      "plan_id" | "current_period_start" | "current_period_end"
    > | null;
  },
): Promise<MeterStatsResult> {
  const { data: cursorData, error: cursorError } = await client
    .from("session_usage_cursors")
    .select("*")
    .eq("session_id", input.sessionId)
    .maybeSingle();

  if (cursorError) {
    throw new Error(`session_usage_cursors read failed: ${cursorError.message}`);
  }
  if (!cursorData) {
    return {
      chargedCredits: 0,
      sessionCredits: 0,
      remaining: null,
      totalAllowance: null,
      usedRatio: null,
      exhausted: false,
      shouldWarn: false,
      costSource: "self_pay",
    };
  }

  const cursor = cursorData as SessionUsageCursorRow;
  const costSource = (
    cursor.cost_source === "hosted" ? "hosted" : "self_pay"
  ) as ProviderCostSource;

  const tokensIn = Math.max(0, Math.floor(input.tokensIn));
  const tokensOut = Math.max(0, Math.floor(input.tokensOut));
  const deltaIn = Math.max(0, tokensIn - cursor.last_tokens_in);
  const deltaOut = Math.max(0, tokensOut - cursor.last_tokens_out);

  if (deltaIn === 0 && deltaOut === 0) {
    let remaining: number | null = null;
    let totalAllowance: number | null = null;
    let usedRatio: number | null = null;
    if (costSource === "hosted" && input.subscription) {
      const balance = await getCreditBalance(client, input.userId, input.subscription);
      remaining = balance.remaining;
      totalAllowance = balance.totalAllowance;
      usedRatio = balance.usedRatio;
    }
    return {
      chargedCredits: 0,
      sessionCredits: cursor.credits_charged,
      remaining,
      totalAllowance,
      usedRatio,
      exhausted: false,
      shouldWarn: false,
      costSource,
    };
  }

  // Attribute deltas to the deep model when present (higher multiplier = safer billing).
  const modelId = cursor.deep_model_id || cursor.quick_model_id;
  const multiplier = await loadMultiplier(client, cursor.provider_id, modelId);
  const deltaCredits =
    costSource === "hosted"
      ? Math.round((deltaIn + deltaOut) * multiplier)
      : 0;

  let remaining: number | null = null;
  let totalAllowance: number | null = null;
  let usedRatio: number | null = null;
  let exhausted = false;
  let shouldWarn = false;
  let warnMessage: string | undefined;
  let chargedCredits = 0;
  let periodId: number | null = null;

  if (costSource === "hosted" && input.subscription) {
    const balance = await getCreditBalance(client, input.userId, input.subscription);
    periodId = balance.period.id;
    const charge = await chargeCredits(client, periodId, deltaCredits);
    remaining = charge.remaining_credits;
    totalAllowance = charge.total_allowance;
    usedRatio =
      charge.total_allowance > 0
        ? Math.min(1, charge.used_credits / charge.total_allowance)
        : 1;
    chargedCredits = charge.allowed ? deltaCredits : 0;
    exhausted = !charge.allowed || charge.remaining_credits <= 0;

    if (exhausted) {
      await markPeriodBlocked(client, periodId);
    } else if (
      !cursor.low_credit_warned &&
      charge.total_allowance > 0 &&
      charge.remaining_credits / charge.total_allowance <= balance.warnRatio
    ) {
      shouldWarn = true;
      warnMessage = `Compute credits are running low — ${charge.remaining_credits.toLocaleString()} of ${charge.total_allowance.toLocaleString()} remaining this period.`;
    }
  } else {
    chargedCredits = 0;
  }

  const { error: eventError } = await client.from("usage_events").insert({
    user_id: input.userId,
    session_id: input.sessionId,
    provider_id: cursor.provider_id,
    model_id: modelId,
    tokens_in: deltaIn,
    tokens_out: deltaOut,
    billable_units: costSource === "hosted" ? chargedCredits : 0,
    cost_source: costSource,
    credit_period_id: periodId,
    created_at: new Date().toISOString(),
  });

  if (eventError) {
    throw new Error(`usage_events insert failed: ${eventError.message}`);
  }

  const nextCharged = cursor.credits_charged + chargedCredits;
  const { error: cursorUpdateError } = await client
    .from("session_usage_cursors")
    .update({
      last_tokens_in: tokensIn,
      last_tokens_out: tokensOut,
      credits_charged: nextCharged,
      low_credit_warned: cursor.low_credit_warned || shouldWarn,
      updated_at: new Date().toISOString(),
    })
    .eq("session_id", input.sessionId);

  if (cursorUpdateError) {
    throw new Error(`session_usage_cursors update failed: ${cursorUpdateError.message}`);
  }

  return {
    chargedCredits,
    sessionCredits: nextCharged,
    remaining,
    totalAllowance,
    usedRatio,
    exhausted,
    shouldWarn,
    warnMessage,
    costSource,
  };
}

/** Billable units helper that prefers DB multipliers when available. */
export async function computeCreditsWithDbMultiplier(
  client: AppSupabaseClient,
  input: {
    tokensIn: number;
    tokensOut: number;
    providerId: string;
    modelId: string;
    costSource: ProviderCostSource;
  },
): Promise<number> {
  if (input.costSource === "self_pay") {
    return 0;
  }
  const multiplier = await loadMultiplier(client, input.providerId, input.modelId);
  const raw = Math.max(0, input.tokensIn) + Math.max(0, input.tokensOut);
  return Math.round(raw * multiplier);
}
