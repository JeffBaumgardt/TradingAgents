/**
 * apps/api/src/services/session-events.test.ts
 *
 * Verifies persisted session events can be read for historical replay.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createInMemorySupabase } from "@tradingagents/supabase/test";
import { getStoredEvents } from "./session-service.js";

describe("getStoredEvents", () => {
  it("returns events in ascending id order", async () => {
    const client = createInMemorySupabase();
    const sessionId = "session-events-1";
    const now = new Date().toISOString();

    await client.from("sessions").insert({
      id: sessionId,
      user_id: "user-1",
      ticker: "AAPL",
      analysis_date: "2026-06-26",
      status: "completed",
      config: {
        ticker: "AAPL",
        analysisDate: "2026-06-26",
        outputLanguage: "English",
        analysts: ["market"],
        researchDepth: 1,
        llmProvider: "openai",
        quickThinkLlm: "gpt-4o-mini",
        deepThinkLlm: "gpt-4o",
      },
      created_at: now,
      updated_at: now,
    });

    await client.from("events").insert({
      session_id: sessionId,
      type: "agent.status",
      payload: { agent: "Market Analyst", status: "completed" },
      created_at: now,
    });
    await client.from("events").insert({
      session_id: sessionId,
      type: "report.section",
      payload: { section: "market_report", content: "Bullish outlook." },
      created_at: now,
    });

    const events = await getStoredEvents(client, sessionId);
    assert.equal(events.length, 2);
    assert.equal(events[0]?.type, "agent.status");
    assert.equal(events[1]?.type, "report.section");
  });
});
