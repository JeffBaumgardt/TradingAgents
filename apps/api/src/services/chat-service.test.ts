/**
 * chat-service unit tests — gates, export markdown, message mapping.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createInMemorySupabase } from "@tradingagents/supabase/test";
import {
  buildSessionExportMarkdown,
  listChatMessages,
} from "./chat-service.js";

describe("chat-service", () => {
  it("listChatMessages returns not_found for missing sessions", async () => {
    const client = createInMemorySupabase();
    const result = await listChatMessages(client, "missing", { requesterId: "user_1" });
    assert.equal(result, "not_found");
  });

  it("export markdown includes research and chat transcript", async () => {
    const client = createInMemorySupabase();
    const userId = "user_export";
    const sessionId = "session_export";

    await client.from("users").insert({
      id: userId,
      email: "export@example.com",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    await client.from("sessions").insert({
      id: sessionId,
      user_id: userId,
      ticker: "SPY",
      analysis_date: "2026-07-22",
      status: "completed",
      config: {
        ticker: "SPY",
        analysisDate: "2026-07-22",
        outputLanguage: "English",
        analysts: ["market"],
        researchDepth: 1,
        llmProvider: "openai",
        thinkLlm: "gpt-4o-mini",
        userContext: "1w dte puts",
      },
      run_id: "run_1",
      report_markdown: "# Report",
      report_sections: {
        final_trade_decision: "Hold — wait for confirmation.",
      },
      decision: "Hold",
      error: null,
      trade_check_json: { header: { ticker: "SPY" } },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    await client.from("session_chat_messages").insert({
      id: "msg_1",
      session_id: sessionId,
      user_id: userId,
      role: "user",
      status: "completed",
      content_markdown: "What if we go slightly OTM?",
      parts: [{ type: "text", content: "What if we go slightly OTM?" }],
      decision_excerpt: null,
      tokens_in: 0,
      tokens_out: 0,
      credits_charged: 0,
      turn_id: null,
      error: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    const markdown = await buildSessionExportMarkdown(client, sessionId);
    assert.notEqual(markdown, "not_found");
    assert.match(String(markdown), /TradingAgents export — SPY/);
    assert.match(String(markdown), /1w dte puts/);
    assert.match(String(markdown), /Hold — wait for confirmation/);
    assert.match(String(markdown), /What if we go slightly OTM/);
  });
});
