/**
 * apps/api/src/services/session-service.test.ts
 *
 * Verifies analysis sessions are scoped to their owning user.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createInMemorySupabase } from "@tradingagents/supabase/test";
import {
  deleteSession,
  getSession,
  listSessions,
  validateCreateRequest,
} from "./session-service.js";

const USER_A = "user_owner_a";
const USER_B = "user_owner_b";

async function insertSession(
  client: ReturnType<typeof createInMemorySupabase>,
  id: string,
  userId: string,
  ticker: string,
): Promise<void> {
  const now = new Date().toISOString();
  await client.from("sessions").insert({
    id,
    user_id: userId,
    ticker,
    analysis_date: "2026-06-26",
    status: "completed",
    config: {
      ticker,
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
}

describe("session-service ownership", () => {
  it("lists and reads sessions only for the owning user", async () => {
    const client = createInMemorySupabase();
    await insertSession(client, "session-a-1", USER_A, "SPY");

    const ownerList = await listSessions(client, USER_A, 20, 0);
    assert.equal(ownerList.total, 1);
    assert.equal(ownerList.items[0]?.id, "session-a-1");

    const otherList = await listSessions(client, USER_B, 20, 0);
    assert.equal(otherList.total, 0);

    assert.notEqual(await getSession(client, "session-a-1", USER_A), null);
    assert.equal(await getSession(client, "session-a-1", USER_B), null);
  });

  it("prevents deleting another user's session", async () => {
    const client = createInMemorySupabase();
    await insertSession(client, "session-a-2", USER_A, "QQQ");

    assert.equal(await deleteSession(client, "session-a-2", USER_B), false);
    assert.notEqual(await getSession(client, "session-a-2", USER_A), null);

    assert.equal(await deleteSession(client, "session-a-2", USER_A), true);
    assert.equal(await getSession(client, "session-a-2", USER_A), null);
  });
});

describe("validateCreateRequest userContext", () => {
  const baseBody = {
    ticker: "SPY",
    analysisDate: "2026-06-26",
    outputLanguage: "English",
    analysts: ["market"] as ["market"],
    researchDepth: 1 as const,
    llmProvider: "openai",
    quickThinkLlm: "gpt-4o-mini",
    deepThinkLlm: "gpt-4o",
  };
  const credentials = {
    openai: { apiKey: "sk-test" },
  };

  it("rejects userContext with control characters", () => {
    const error = validateCreateRequest(
      { ...baseBody, userContext: "hello\x00world" },
      credentials,
    );
    assert.match(error ?? "", /invalid characters/);
  });

  it("rejects oversized userContext", () => {
    const error = validateCreateRequest(
      { ...baseBody, userContext: "a".repeat(8193) },
      credentials,
    );
    assert.match(error ?? "", /at most/);
  });
});
