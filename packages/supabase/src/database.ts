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
