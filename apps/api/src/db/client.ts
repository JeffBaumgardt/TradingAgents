/**
 * Helpers for accessing Supabase clients from Hono request context.
 */

import type { Context } from "hono";
import type { AppSupabaseClient } from "./database.js";

export function getSupabaseAdmin(c: Context): AppSupabaseClient {
  const context = c.var.supabaseContext;
  if (!context) {
    throw new Error("Supabase context missing — apply withSupabase middleware first");
  }
  return context.supabaseAdmin as AppSupabaseClient;
}

export function getSupabaseUser(c: Context): AppSupabaseClient {
  const context = c.var.supabaseContext;
  if (!context) {
    throw new Error("Supabase context missing — apply withSupabase middleware first");
  }
  return context.supabase as AppSupabaseClient;
}
