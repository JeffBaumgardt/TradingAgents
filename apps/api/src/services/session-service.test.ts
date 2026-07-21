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
  toShareSession,
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

  it("allows reading a session by id without a userId for share links", async () => {
    const client = createInMemorySupabase();
    await insertSession(client, "session-share-1", USER_A, "AAPL");

    const shared = await getSession(client, "session-share-1");
    assert.notEqual(shared, null);
    assert.equal(shared?.ticker, "AAPL");
  });

  it("redacts owner fields for anonymous share payloads", async () => {
    const client = createInMemorySupabase();
    await insertSession(client, "session-share-2", USER_A, "MSFT");

    const session = await getSession(client, "session-share-2");
    assert.ok(session);
    session.config.userContext = "private thesis notes";

    const share = toShareSession(session);
    assert.equal(share.userId, null);
    assert.equal(share.runId, null);
    assert.equal(share.error, null);
    assert.equal(share.config.userContext, undefined);
    assert.equal(share.config.backendUrl, undefined);
    assert.equal(share.ticker, "MSFT");
    assert.equal(session.userId, USER_A);
    assert.equal(session.config.userContext, "private thesis notes");
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

describe("validateCreateRequest hosted providers", () => {
  const baseBody = {
    ticker: "SPY",
    analysisDate: "2026-06-26",
    outputLanguage: "English",
    analysts: ["market"] as ["market"],
    researchDepth: 1 as const,
    llmProvider: "anthropic",
    quickThinkLlm: "claude-sonnet-4",
    deepThinkLlm: "claude-opus-4",
  };

  it("rejects a provider without a stored key when hosted is not allowed", () => {
    const error = validateCreateRequest(baseBody, {
      openai: { apiKey: "sk-test" },
    });
    assert.match(error ?? "", /No credentials provided for selected provider/);
  });

  it("allows a hosted catalog provider without a user-stored key", () => {
    const error = validateCreateRequest(
      baseBody,
      { openai: { apiKey: "sk-test" } },
      {
        allowHostedProvider: true,
        hostedProviderIds: ["openai", "anthropic", "google"],
      },
    );
    assert.equal(error, null);
  });

  it("allows a fully keyless hosted create for a catalog provider", () => {
    const error = validateCreateRequest(
      baseBody,
      {},
      {
        allowHostedProvider: true,
        hostedProviderIds: ["anthropic"],
      },
    );
    assert.equal(error, null);
  });

  it("still requires a key for providers outside the hosted catalog", () => {
    const error = validateCreateRequest(
      { ...baseBody, llmProvider: "ollama" },
      { openai: { apiKey: "sk-test" } },
      {
        allowHostedProvider: true,
        hostedProviderIds: ["openai", "anthropic"],
      },
    );
    assert.match(error ?? "", /No credentials provided for selected provider/);
  });
});
