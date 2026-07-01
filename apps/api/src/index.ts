/**
 * apps/api/src/index.ts
 *
 * Entry point for the TradingAgents TypeScript API gateway (port 4000).
 * Proxies analysis runs to the Python agents-service and persists session state.
 */

import { serve } from "@hono/node-server";
import { createApp } from "./app.js";

const port = Number(process.env.PORT ?? 4000);
const app = createApp();

console.log(`TradingAgents API listening on http://localhost:${port}`);

serve({ fetch: app.fetch, port });
