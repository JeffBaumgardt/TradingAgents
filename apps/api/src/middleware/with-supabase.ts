/**
 * Supabase Hono middleware with explicit client-creation error logging.
 * Uses auth: "none" — same as the previous withSupabase({ auth: "none" }) wiring.
 */

import { AuthError } from "@tradingagents/supabase/server";
import {
  createAdminClient,
  createContextClient,
  verifyAuth,
} from "@supabase/server/core";
import { EnvError } from "@supabase/server";
import type { SupabaseContext } from "@supabase/server";
import { createMiddleware } from "hono/factory";
import { HTTPException } from "hono/http-exception";

function toAuthError(error: unknown): AuthError {
  if (error instanceof EnvError) {
    return new AuthError(error.message, error.code, 500);
  }
  if (error instanceof AuthError) {
    return error;
  }
  if (error instanceof Error) {
    console.error("[api] Supabase client creation threw:", {
      name: error.name,
      message: error.message,
    });
    return new AuthError(error.message, "CREATE_SUPABASE_CLIENT_ERROR", 500);
  }
  console.error("[api] Supabase client creation threw:", error);
  return new AuthError(
    "Failed to create Supabase client",
    "CREATE_SUPABASE_CLIENT_ERROR",
    500,
  );
}

export function withSupabaseContext() {
  return createMiddleware<{
    Variables: { supabaseContext: SupabaseContext };
  }>(async (c, next) => {
    if (c.var.supabaseContext) {
      await next();
      return;
    }

    const { data: auth, error: authError } = await verifyAuth(c.req.raw, {
      auth: "none",
    });
    if (authError) {
      throw new HTTPException(authError.status as 401 | 500, {
        message: authError.message,
        cause: authError,
      });
    }

    try {
      const supabase = createContextClient({
        auth: { token: auth.token, keyName: undefined },
      });
      const supabaseAdmin = createAdminClient({});
      c.set("supabaseContext", {
        supabase,
        supabaseAdmin,
        userClaims: auth.userClaims,
        jwtClaims: auth.jwtClaims,
        authMode: auth.authMode,
        authKeyName: auth.keyName ?? undefined,
      });
    } catch (error) {
      const mapped = toAuthError(error);
      throw new HTTPException(mapped.status as 401 | 500, {
        message: mapped.message,
        cause: mapped,
      });
    }

    await next();
  });
}
