/**
 * apps/api/src/app.ts
 *
 * Hono application wiring for the TradingAgents API gateway.
 * Mounts health, config, and session routes defined in the OpenAPI spec.
 */

import { withSupabase } from "@supabase/server/adapters/hono";
import { AuthError } from "@supabase/server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { HTTPException } from "hono/http-exception";
import { logger } from "hono/logger";
import { healthRoutes } from "./routes/health.js";
import { configRoutes } from "./routes/config.js";
import { credentialsRoutes } from "./routes/credentials.js";
import { sessionRoutes } from "./routes/sessions.js";
import { userRoutes } from "./routes/users.js";
import { webhookRoutes } from "./routes/webhooks.js";
import "./types/hono.js";

type AppEnv = {
  Variables: {
    userId: string;
    supabaseContext: import("@supabase/server").SupabaseContext;
  };
};

export function createApp() {
  const app = new Hono<AppEnv>();

  app.use("*", logger());
  app.use(
    "*",
    cors({
      origin: process.env.CORS_ORIGIN ?? "*",
      allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
      allowHeaders: ["Content-Type", "Authorization", "apikey", "X-User-Id"],
    }),
  );

  // Provides ctx.supabase (RLS-scoped) and ctx.supabaseAdmin on every request.
  // Routes use supabaseAdmin with existing Clerk / X-User-Id auth until Supabase JWT auth is wired up.
  app.use("*", withSupabase({ auth: "none" }));

  app.route("/", healthRoutes);
  app.route("/", configRoutes);
  app.route("/", credentialsRoutes);
  app.route("/", userRoutes);
  app.route("/", webhookRoutes);
  app.route("/", sessionRoutes);

  app.notFound((c) => c.json({ error: "Not found" }, 404));

  app.onError((error, c) => {
    if (error instanceof HTTPException && error.cause instanceof AuthError) {
      const authError = error.cause;
      return c.json(
        { error: authError.message, code: authError.code },
        authError.status as 401 | 500,
      );
    }

    console.error(error);
    return c.json({ error: "Internal server error" }, 500);
  });

  return app;
}
