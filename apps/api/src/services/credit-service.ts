/**
 * apps/api/src/services/credit-service.ts
 *
 * Hosted compute-credit periods, rollover (prior month only), pre-flight
 * gating, and live metering from SSE stats deltas.
 */

import {
  HOSTED_MONTHLY_COMPUTE_CREDIT_ALLOWANCE,
  getModelCreditMultiplier,
  resolveThinkLlm,
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

function utcClampedDay(year: number, monthIndex: number, day: number): Date {
  const lastDay = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
  return new Date(Date.UTC(year, monthIndex, Math.min(day, lastDay), 0, 0, 0, 0));
}

/**
 * Monthly credit window independent of Stripe billing interval.
 * Annual subscriptions still receive a fresh monthly allowance each month,
 * anchored to the subscription period start's UTC day-of-month.
 */
export function resolveMonthlyCreditWindow(input: {
  subscriptionPeriodStart: string | null | undefined;
  subscriptionPeriodEnd: string | null | undefined;
  now?: Date;
}): { periodStart: string; periodEnd: string } {
  const now = input.now ?? new Date();
  const hasStart = Boolean(input.subscriptionPeriodStart);
  const hasEnd = Boolean(input.subscriptionPeriodEnd);
  const subStart = hasStart
    ? new Date(input.subscriptionPeriodStart as string)
    : new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const subEnd = hasEnd
    ? new Date(input.subscriptionPeriodEnd as string)
    : new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));

  if (!Number.isFinite(subStart.getTime()) || !Number.isFinite(subEnd.getTime()) || subEnd <= subStart) {
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
    return { periodStart: start.toISOString(), periodEnd: end.toISOString() };
  }

  const anchorDay = subStart.getUTCDate();
  let windowStart = utcClampedDay(now.getUTCFullYear(), now.getUTCMonth(), anchorDay);
  if (windowStart.getTime() > now.getTime()) {
    windowStart = utcClampedDay(now.getUTCFullYear(), now.getUTCMonth() - 1, anchorDay);
  }
  let windowEnd = utcClampedDay(
    windowStart.getUTCFullYear(),
    windowStart.getUTCMonth() + 1,
    anchorDay,
  );

  if (windowStart.getTime() < subStart.getTime()) {
    windowStart = subStart;
  }
  if (windowEnd.getTime() > subEnd.getTime()) {
    windowEnd = subEnd;
  }
  if (windowEnd.getTime() <= windowStart.getTime()) {
    windowEnd = new Date(windowStart.getTime() + 24 * 60 * 60 * 1000);
  }

  return {
    periodStart: windowStart.toISOString(),
    periodEnd: windowEnd.toISOString(),
  };
}

function allowNonAtomicCreditFallback(): boolean {
  return (
    process.env.NODE_ENV === "test" ||
    process.env.CREDIT_ALLOW_NON_ATOMIC_FALLBACK === "true"
  );
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
  now = new Date(),
): Promise<UserCreditPeriodRow> {
  const { periodStart, periodEnd } = resolveMonthlyCreditWindow({
    subscriptionPeriodStart: subscription.current_period_start,
    subscriptionPeriodEnd: subscription.current_period_end,
    now,
  });

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
  const createdAt = new Date().toISOString();

  const insertRow = {
    user_id: userId,
    period_start: periodStart,
    period_end: periodEnd,
    base_allowance: config.monthly_credit_allowance,
    rollover_credits: rollover,
    used_credits: 0,
    blocked_low_balance: false,
    created_at: createdAt,
    updated_at: createdAt,
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

  const thinkLlm = resolveThinkLlm(body);
  const thinkMult = await loadMultiplier(client, body.llmProvider, thinkLlm);

  return Math.round(baseTokens * analystFactor * thinkMult);
}

/** Typical follow-up chat turn (~8k tokens) × model multiplier. */
const DEFAULT_FOLLOW_UP_TOKEN_ESTIMATE = 8_000;

export async function estimateFollowUpCredits(
  client: AppSupabaseClient,
  input: {
    llmProvider: string;
    thinkLlm: string;
    costSource: ProviderCostSource;
  },
): Promise<number> {
  if (input.costSource === "self_pay") {
    return 0;
  }
  const thinkMult = await loadMultiplier(client, input.llmProvider, input.thinkLlm);
  return Math.round(DEFAULT_FOLLOW_UP_TOKEN_ESTIMATE * thinkMult);
}

/**
 * Gate a hosted follow-up chat turn. Uses a small turn estimate (not full-run depth).
 */
export async function assertHostedCreditsForFollowUp(
  client: AppSupabaseClient,
  userId: string,
  subscription: Pick<
    UserSubscriptionRow,
    "plan_id" | "current_period_start" | "current_period_end"
  >,
  input: {
    llmProvider: string;
    thinkLlm: string;
    costSource: ProviderCostSource;
  },
): Promise<CreditGateResult> {
  if (subscription.plan_id !== "hosted" || input.costSource !== "hosted") {
    return { allowed: true, code: "not_hosted" };
  }

  const balance = await getCreditBalance(client, userId, subscription);
  const estimatedCredits = await estimateFollowUpCredits(client, input);
  const inFlightReserved =
    (await sumInFlightHostedCreditReservations(client, userId)) +
    (await sumInFlightFollowUpReservations(client, userId, {
      llmProvider: input.llmProvider,
      thinkLlm: input.thinkLlm,
    }));
  const { period, remaining, totalAllowance, blockRatio } = balance;
  const available = Math.max(0, remaining - inFlightReserved);

  if (period.blocked_low_balance) {
    return {
      allowed: false,
      code: "credits_blocked",
      message:
        "Your hosted compute credits are too low to continue chatting this billing period. " +
        "Usage resets at the start of your next period.",
      balance,
      estimatedCredits,
    };
  }

  const blockFloor = Math.ceil(totalAllowance * blockRatio);
  if (remaining < blockFloor) {
    await markPeriodBlocked(client, period.id);
    return {
      allowed: false,
      code: "credits_insufficient",
      message: `You have less than ${Math.round(blockRatio * 100)}% of your compute credit allowance remaining (${remaining.toLocaleString()} of ${totalAllowance.toLocaleString()}). Follow-up chat is blocked for the rest of this credit period.`,
      balance,
      estimatedCredits,
    };
  }

  if (estimatedCredits > available) {
    return {
      allowed: false,
      code: "credits_insufficient",
      message: `Not enough compute credits for another chat turn (need ~${estimatedCredits.toLocaleString()}, ~${available.toLocaleString()} available after in-flight runs).`,
      balance,
      estimatedCredits,
    };
  }

  return { allowed: true, balance, estimatedCredits };
}

/**
 * Remaining estimate still committed to in-flight hosted runs for this user.
 * Prevents concurrent session creates from each passing the same balance gate.
 * Counts both `pending` and `running` so the window before startRun is covered.
 */
async function sumInFlightHostedCreditReservations(
  client: AppSupabaseClient,
  userId: string,
  options: { excludeSessionId?: string } = {},
): Promise<number> {
  const { data: activeSessions, error: sessionError } = await client
    .from("sessions")
    .select("id, config, status, run_id")
    .eq("user_id", userId);

  if (sessionError) {
    throw new Error(`sessions in-flight read failed: ${sessionError.message}`);
  }

  const sessions = ((activeSessions ?? []) as Array<{
    id: string;
    config: CreateSessionRequest;
    status: string;
    run_id?: string | null;
  }>).filter((session) => {
    if (session.id === options.excludeSessionId) {
      return false;
    }
    if (session.status === "pending" || session.status === "running") {
      return true;
    }
    // Soft-deleted but still being metered after cancel (cursor retained until
    // the agents stream ends). Terminal deletes clear the cursor separately.
    return session.status === "deleted" && Boolean(session.run_id);
  });
  if (sessions.length === 0) {
    return 0;
  }

  const sessionIds = new Set(sessions.map((session) => session.id));
  const { data: cursors, error: cursorError } = await client
    .from("session_usage_cursors")
    .select("session_id, cost_source, credits_charged")
    .eq("user_id", userId)
    .eq("cost_source", "hosted");

  if (cursorError) {
    throw new Error(`session_usage_cursors in-flight read failed: ${cursorError.message}`);
  }

  const hostedBySession = new Map(
    ((cursors ?? []) as Array<{
      session_id: string;
      cost_source: string;
      credits_charged: number;
    }>)
      .filter((row) => sessionIds.has(row.session_id))
      .map((row) => [row.session_id, asNumber(row.credits_charged)]),
  );

  let reserved = 0;
  for (const session of sessions) {
    const charged = hostedBySession.get(session.id);
    if (charged == null) {
      continue;
    }
    const estimated = await estimateRunCredits(client, session.config, "hosted");
    reserved += Math.max(0, estimated - charged);
  }
  return reserved;
}

/**
 * Reserve estimate for hosted follow-up chats already streaming (completed
 * sessions with an in-progress assistant message). Prevents concurrent chat
 * POSTs across many sessions from each clearing the same remaining balance.
 */
async function sumInFlightFollowUpReservations(
  client: AppSupabaseClient,
  userId: string,
  input: { llmProvider: string; thinkLlm: string },
): Promise<number> {
  const { data: streaming, error } = await client
    .from("session_chat_messages")
    .select("session_id")
    .eq("user_id", userId)
    .eq("role", "assistant")
    .in("status", ["pending", "streaming"]);

  if (error) {
    throw new Error(`session_chat_messages in-flight read failed: ${error.message}`);
  }

  const sessionIds = [
    ...new Set(
      ((streaming ?? []) as Array<{ session_id: string }>).map((row) => row.session_id),
    ),
  ];
  if (sessionIds.length === 0) {
    return 0;
  }

  const { data: cursors, error: cursorError } = await client
    .from("session_usage_cursors")
    .select("session_id, cost_source, credits_charged, usage_kind")
    .eq("user_id", userId)
    .eq("cost_source", "hosted");

  if (cursorError) {
    throw new Error(`session_usage_cursors follow-up read failed: ${cursorError.message}`);
  }

  const estimate = await estimateFollowUpCredits(client, {
    llmProvider: input.llmProvider,
    thinkLlm: input.thinkLlm,
    costSource: "hosted",
  });

  const hostedFollowUp = new Map(
    ((cursors ?? []) as Array<{
      session_id: string;
      credits_charged: number;
      usage_kind?: string;
    }>)
      .filter(
        (row) =>
          sessionIds.includes(row.session_id) &&
          (row.usage_kind === "follow_up" || row.usage_kind == null),
      )
      .map((row) => [row.session_id, asNumber(row.credits_charged)]),
  );

  let reserved = 0;
  for (const sessionId of sessionIds) {
    const charged = hostedFollowUp.get(sessionId);
    if (charged == null) {
      // Streaming chat without a hosted cursor is self_pay / not our reservation.
      continue;
    }
    reserved += Math.max(0, estimate - charged);
  }
  return reserved;
}

/**
 * After inserting a pending hosted session, ensure the full in-flight set
 * (including this session) still fits in the remaining balance.
 */
export async function assertHostedInFlightWithinBalance(
  client: AppSupabaseClient,
  userId: string,
  subscription: Pick<
    UserSubscriptionRow,
    "plan_id" | "current_period_start" | "current_period_end"
  >,
): Promise<CreditGateResult> {
  if (subscription.plan_id !== "hosted") {
    return { allowed: true, code: "not_hosted" };
  }

  const balance = await getCreditBalance(client, userId, subscription);
  const inFlightReserved = await sumInFlightHostedCreditReservations(client, userId);
  const { remaining, totalAllowance, blockRatio, period } = balance;

  if (period.blocked_low_balance || remaining < Math.ceil(totalAllowance * blockRatio)) {
    return {
      allowed: false,
      code: "credits_insufficient",
      message: `You have less than ${Math.round(blockRatio * 100)}% of your compute credit allowance remaining. New hosted runs are blocked for the rest of this credit period.`,
      balance,
    };
  }

  if (inFlightReserved > remaining) {
    return {
      allowed: false,
      code: "credits_insufficient",
      message: `Concurrent hosted runs would use about ${inFlightReserved.toLocaleString()} compute credits, but you only have ${remaining.toLocaleString()} remaining. Wait for an in-progress run to finish, or try a cheaper model.`,
      balance,
    };
  }

  return { allowed: true, balance };
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
  const inFlightReserved = await sumInFlightHostedCreditReservations(client, userId);
  const { period, remaining, totalAllowance, blockRatio } = balance;
  const available = Math.max(0, remaining - inFlightReserved);

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
  if (remaining < blockFloor) {
    await markPeriodBlocked(client, period.id);
    return {
      allowed: false,
      code: "credits_insufficient",
      message: `You have less than ${Math.round(blockRatio * 100)}% of your compute credit allowance remaining (${remaining.toLocaleString()} of ${totalAllowance.toLocaleString()}). New hosted runs are blocked for the rest of this credit period.`,
      balance,
      estimatedCredits,
    };
  }

  if (available < estimatedCredits) {
    // Reject this run only — do not latch the period closed.
    const busyHint =
      inFlightReserved > 0
        ? ` About ${inFlightReserved.toLocaleString()} credits are already reserved by runs still in progress.`
        : "";
    return {
      allowed: false,
      code: "credits_insufficient",
      message: `This run is estimated to use about ${estimatedCredits.toLocaleString()} compute credits, but you only have ${available.toLocaleString()} available after in-flight usage (${remaining.toLocaleString()} remaining).${busyHint} Try a cheaper model or lower research depth, or wait until a run finishes or your allowance resets.`,
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

  if (!allowNonAtomicCreditFallback()) {
    throw new Error(
      `charge_user_credits RPC unavailable: ${rpcError?.message ?? "unknown error"}`,
    );
  }

  // Test-only fallback (in-memory). Production must use the SQL function.
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
    usageKind?: "analysis_run" | "follow_up";
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
      usage_kind: input.usageKind ?? "analysis_run",
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
 * Meter a cumulative stats snapshot. Prefer the atomic SQL RPC so charge,
 * usage_event insert, and cursor advance commit together (no double-bill).
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
  const modelId = cursor.deep_model_id || cursor.quick_model_id;
  const multiplier = await loadMultiplier(client, cursor.provider_id, modelId);

  let periodId: number | null = null;
  let warnRatio = 0.1;
  if (costSource === "hosted") {
    if (!input.subscription) {
      throw new Error("hosted metering requires an active subscription period");
    }
    const balance = await getCreditBalance(client, input.userId, input.subscription);
    if (balance.period.user_id !== input.userId) {
      throw new Error("credit period user mismatch");
    }
    periodId = balance.period.id;
    warnRatio = balance.warnRatio;
  }

  const { data: rpcData, error: rpcError } = await client.rpc("meter_session_usage", {
    p_session_id: input.sessionId,
    p_user_id: input.userId,
    p_tokens_in: tokensIn,
    p_tokens_out: tokensOut,
    p_period_id: periodId,
    p_credit_multiplier: multiplier,
    p_warn_ratio: warnRatio,
  });

  if (!rpcError && Array.isArray(rpcData) && rpcData[0]) {
    const row = rpcData[0] as {
      charged_credits: number;
      session_credits: number;
      remaining_credits: number | null;
      total_allowance: number | null;
      used_ratio: number | null;
      exhausted: boolean;
      should_warn: boolean;
      warn_message: string | null;
      cost_source: string;
    };
    return {
      chargedCredits: asNumber(row.charged_credits),
      sessionCredits: asNumber(row.session_credits),
      remaining: row.remaining_credits == null ? null : asNumber(row.remaining_credits),
      totalAllowance: row.total_allowance == null ? null : asNumber(row.total_allowance),
      usedRatio: row.used_ratio == null ? null : asNumber(row.used_ratio),
      exhausted: Boolean(row.exhausted),
      shouldWarn: Boolean(row.should_warn),
      warnMessage: row.warn_message ?? undefined,
      costSource: row.cost_source === "hosted" ? "hosted" : "self_pay",
    };
  }

  if (!allowNonAtomicCreditFallback()) {
    throw new Error(
      `meter_session_usage RPC unavailable: ${rpcError?.message ?? "unknown error"}`,
    );
  }

  // Test-only non-atomic path (in-memory without the SQL function).
  return meterSessionStatsLegacyFallback(client, {
    cursor,
    costSource,
    tokensIn,
    tokensOut,
    multiplier,
    periodId,
    warnRatio,
    userId: input.userId,
    sessionId: input.sessionId,
    subscription: input.subscription,
  });
}

/** @internal Test-only fallback when meter_session_usage RPC is absent. */
async function meterSessionStatsLegacyFallback(
  client: AppSupabaseClient,
  input: {
    cursor: SessionUsageCursorRow;
    costSource: ProviderCostSource;
    tokensIn: number;
    tokensOut: number;
    multiplier: number;
    periodId: number | null;
    warnRatio: number;
    userId: string;
    sessionId: string;
    subscription: Pick<
      UserSubscriptionRow,
      "plan_id" | "current_period_start" | "current_period_end"
    > | null;
  },
): Promise<MeterStatsResult> {
  const { cursor, costSource } = input;
  const deltaIn = Math.max(0, input.tokensIn - cursor.last_tokens_in);
  const deltaOut = Math.max(0, input.tokensOut - cursor.last_tokens_out);
  const modelId = cursor.deep_model_id || cursor.quick_model_id;

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

  const deltaCredits =
    costSource === "hosted" ? Math.round((deltaIn + deltaOut) * input.multiplier) : 0;

  let remaining: number | null = null;
  let totalAllowance: number | null = null;
  let usedRatio: number | null = null;
  let exhausted = false;
  let shouldWarn = false;
  let warnMessage: string | undefined;
  let chargedCredits = 0;

  if (costSource === "hosted" && input.periodId != null) {
    const charge = await chargeCredits(client, input.periodId, deltaCredits);
    remaining = charge.remaining_credits;
    totalAllowance = charge.total_allowance;
    usedRatio =
      charge.total_allowance > 0
        ? Math.min(1, charge.used_credits / charge.total_allowance)
        : 1;
    chargedCredits = charge.allowed
      ? deltaCredits
      : Math.max(0, charge.total_allowance - (charge.used_credits - 0));
    // Soft overshoot: if not allowed, charge remaining via a second call of 0 — already rejected.
    if (!charge.allowed) {
      const leftover = charge.remaining_credits;
      if (leftover > 0) {
        const partial = await chargeCredits(client, input.periodId, leftover);
        chargedCredits = partial.allowed ? leftover : 0;
        remaining = partial.remaining_credits;
        totalAllowance = partial.total_allowance;
        usedRatio =
          partial.total_allowance > 0
            ? Math.min(1, partial.used_credits / partial.total_allowance)
            : 1;
      } else {
        chargedCredits = 0;
      }
      exhausted = true;
    } else {
      exhausted = charge.remaining_credits <= 0;
    }

    if (exhausted) {
      await markPeriodBlocked(client, input.periodId);
    } else if (
      !cursor.low_credit_warned &&
      totalAllowance != null &&
      totalAllowance > 0 &&
      remaining != null &&
      remaining / totalAllowance <= input.warnRatio
    ) {
      shouldWarn = true;
      warnMessage = `Compute credits are running low — ${remaining.toLocaleString()} of ${totalAllowance.toLocaleString()} remaining this period.`;
    }
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
    usage_kind: cursor.usage_kind ?? "analysis_run",
    credit_period_id: input.periodId,
    created_at: new Date().toISOString(),
  });

  if (eventError) {
    throw new Error(`usage_events insert failed: ${eventError.message}`);
  }

  const nextCharged = cursor.credits_charged + chargedCredits;
  const { error: cursorUpdateError } = await client
    .from("session_usage_cursors")
    .update({
      last_tokens_in: input.tokensIn,
      last_tokens_out: input.tokensOut,
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
