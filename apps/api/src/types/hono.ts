import type { SupabaseContext } from "@supabase/server";
import type { Context } from "hono";

declare module "hono" {
  interface ContextVariableMap {
    userId: string;
    supabaseContext: SupabaseContext;
  }
}

export type AppContext = Context;
