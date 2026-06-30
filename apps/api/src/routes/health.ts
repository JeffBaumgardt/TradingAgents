/**
 * apps/api/src/routes/health.ts
 *
 * Health check route for load balancers and orchestration probes.
 */

import { Hono } from "hono";
import { checkAgentsHealth } from "../services/agents-client.js";

export const healthRoutes = new Hono();

healthRoutes.get("/health", async (c) => {
  const agentsOk = await checkAgentsHealth();
  return c.json({
    status: agentsOk ? "ok" : "degraded",
    service: "tradingagents-api",
    agentsService: agentsOk ? "ok" : "unreachable",
  });
});
