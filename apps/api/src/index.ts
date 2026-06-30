/**
 * apps/api/src/index.ts
 *
 * Entry point for the TradingAgents TypeScript API gateway (port 4000).
 * Proxies analysis runs to the Python agents-service and persists session state.
 */

import { serve } from "@hono/node-server";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { createApp } from "./app.js";
import { initializeDatabase } from "./db/index.js";

const port = Number(process.env.PORT ?? 4000);
const databasePath = process.env.DATABASE_PATH ?? "./data/tradingagents-api.db";

mkdirSync(dirname(databasePath), { recursive: true });
initializeDatabase();

const app = createApp();

console.log(`TradingAgents API listening on http://localhost:${port}`);

serve({ fetch: app.fetch, port });
