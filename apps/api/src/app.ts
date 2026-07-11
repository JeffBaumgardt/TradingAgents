/**
 * apps/api/src/app.ts
 *
 * Hono application wiring for the TradingAgents API gateway.
 * Mounts health, config, and session routes defined in the OpenAPI spec.
 */

import { AuthError } from "@tradingagents/supabase/server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { HTTPException } from "hono/http-exception";
import { logger } from "hono/logger";
import { securityHeadersMiddleware } from "./middleware/security-headers.js";
import { withSupabaseContext } from "./middleware/with-supabase.js";
import { healthRoutes } from "./routes/health.js";
import { configRoutes } from "./routes/config.js";
import { credentialsRoutes } from "./routes/credentials.js";
import { feedbackRoutes } from "./routes/feedback.js";
import { sessionRoutes } from "./routes/sessions.js";
import { userRoutes } from "./routes/users.js";
import { webhookRoutes } from "./routes/webhooks.js";
import "./types/hono.js";

type AppEnv = {
  Variables: {
    userId: string;
    supabaseContext: import("@tradingagents/supabase/server").SupabaseContext;
  };
};

export function createApp() {
  const app = new Hono<AppEnv>();

  app.use("*", logger());
  app.use("*", securityHeadersMiddleware());
  app.use(
    "*",
    cors({
      origin: process.env.CORS_ORIGIN ?? "*",
      allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
      allowHeaders: ["Content-Type", "Authorization", "apikey"],
    }),
  );

  // Liveness probe — must not depend on Supabase or auth (Railway/load balancers).
  app.route("/", healthRoutes);

  // Provides ctx.supabase (RLS-scoped) and ctx.supabaseAdmin on every request.
  // Protected routes verify Clerk session tokens via requireUserId().
  app.use("*", withSupabaseContext());

  app.route("/", configRoutes);
  app.route("/", webhookRoutes);
  app.route("/", credentialsRoutes);
  app.route("/", userRoutes);
  app.route("/", feedbackRoutes);
  app.route("/", sessionRoutes);

  app.notFound((c) => c.json({ error: "Not found" }, 404));

  app.onError((error, c) => {
    if (error instanceof HTTPException && error.cause instanceof AuthError) {
      const authError = error.cause;
      console.error("[api] auth middleware error:", {
        path: c.req.path,
        method: c.req.method,
        code: authError.code,
        message: authError.message,
        status: authError.status,
      });
      return c.json(
        { error: authError.message, code: authError.code },
        authError.status as 401 | 500,
      );
    }

    console.error("[api] unhandled error:", {
      path: c.req.path,
      method: c.req.method,
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return c.json({ error: "Internal server error" }, 500);
  });

  return app;
}
