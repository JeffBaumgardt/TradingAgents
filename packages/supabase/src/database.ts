/**
 * Supabase Postgres schema types for the API gateway.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { CreateSessionRequest } from "@tradingagents/api-types";

export type AppSupabaseClient = SupabaseClient;

export interface SessionRow {
  id: string;
  user_id: string | null;
  ticker: string;
  analysis_date: string;
  status: string;
  config: CreateSessionRequest;
  run_id: string | null;
  report_markdown: string | null;
  report_sections: Record<string, string | null> | null;
  decision: string | null;
  error: string | null;
  trade_check_json?: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface EventRow {
  id: number;
  session_id: string;
  type: string;
  payload: Record<string, unknown>;
  created_at: string;
}

export interface UserRow {
  id: string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  image_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserCredentialRow {
  user_id: string;
  provider_id: string;
  field_name: string;
  field_value: string;
  updated_at: string;
}

export interface UserSubscriptionRow {
  user_id: string;
  plan_id: string;
  interval: string;
  status: string;
  current_period_start: string;
  current_period_end: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  stripe_checkout_session_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface PlanCreditConfigRow {
  plan_id: string;
  monthly_credit_allowance: number;
  low_balance_block_ratio: number;
  low_balance_warn_ratio: number;
  max_rollover_periods: number;
  estimated_tokens_by_depth: Record<string, number>;
  reference_output_usd_per_1m: number;
  updated_at: string;
}

export interface ModelCreditMultiplierRow {
  provider_id: string;
  model_id: string;
  display_name: string;
  provider_label: string;
  input_usd_per_1m: number;
  output_usd_per_1m: number;
  credit_multiplier: number;
  modes: string[];
  notes: string | null;
  is_active: boolean;
  updated_at: string;
}

/** Hosted provider keys — never expose ciphertext or plaintext via public APIs. */
export interface PlatformApiKeyRow {
  provider_id: string;
  encrypted_api_key: string;
  label: string | null;
  is_active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserCreditPeriodRow {
  id: number;
  user_id: string;
  period_start: string;
  period_end: string;
  base_allowance: number;
  rollover_credits: number;
  used_credits: number;
  blocked_low_balance: boolean;
  created_at: string;
  updated_at: string;
}

export interface UsageEventRow {
  id: number;
  user_id: string;
  session_id: string | null;
  provider_id: string;
  model_id: string;
  tokens_in: number;
  tokens_out: number;
  billable_units: number;
  cost_source: string;
  credit_period_id: number | null;
  created_at: string;
}

export interface SessionUsageCursorRow {
  session_id: string;
  user_id: string;
  provider_id: string;
  quick_model_id: string;
  deep_model_id: string;
  cost_source: string;
  last_tokens_in: number;
  last_tokens_out: number;
  credits_charged: number;
  low_credit_warned: boolean;
  created_at: string;
  updated_at: string;
}
