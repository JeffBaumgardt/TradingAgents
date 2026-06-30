/**
 * apps/api/src/app.ts
 *
 * Hono application wiring for the TradingAgents API gateway.
 * Mounts health, config, and session routes defined in the OpenAPI spec.
 */

import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { healthRoutes } from "./routes/health.js";
import { configRoutes } from "./routes/config.js";
import { sessionRoutes } from "./routes/sessions.js";

export function createApp() {
  const app = new Hono();

  app.use("*", logger());
  app.use(
    "*",
    cors({
      origin: process.env.CORS_ORIGIN ?? "*",
      allowMethods: ["GET", "POST", "DELETE", "OPTIONS"],
    }),
  );

  app.route("/", healthRoutes);
  app.route("/", configRoutes);
  app.route("/", sessionRoutes);

  app.notFound((c) => c.json({ error: "Not found" }, 404));

  app.onError((error, c) => {
    console.error(error);
    return c.json({ error: "Internal server error" }, 500);
  });

  return app;
}
