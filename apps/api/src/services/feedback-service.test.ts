/**
 * apps/api/src/services/feedback-service.test.ts
 *
 * Validates feedback parsing, session scoping, config errors, and email wiring.
 */

import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { createInMemorySupabase } from "@tradingagents/supabase/test";
import {
  FeedbackServiceError,
  buildFeedbackEmailContent,
  parseFeedbackRequest,
  resetFeedbackRateLimitForTests,
  sendFeedbackEmail,
  type FeedbackEmailPayload,
} from "./feedback-service.js";

const USER_A = "user_feedback_a";
const USER_B = "user_feedback_b";

const ORIGINAL_ENV = {
  RESEND_API_KEY: process.env.RESEND_API_KEY,
  FEEDBACK_TO_EMAIL: process.env.FEEDBACK_TO_EMAIL,
  FEEDBACK_FROM_EMAIL: process.env.FEEDBACK_FROM_EMAIL,
};

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
    analysis_date: "2026-07-11",
    status: "completed",
    decision: "Buy",
    run_id: "run-feedback-1",
    config: {
      ticker,
      analysisDate: "2026-07-11",
      outputLanguage: "English",
      analysts: ["market", "news"],
      researchDepth: 3,
      llmProvider: "openai",
      quickThinkLlm: "gpt-4o-mini",
      deepThinkLlm: "gpt-4o",
    },
    created_at: now,
    updated_at: now,
  });
}

async function insertUser(
  client: ReturnType<typeof createInMemorySupabase>,
  id: string,
  email: string | null,
): Promise<void> {
  const now = new Date().toISOString();
  await client.from("users").insert({
    id,
    email,
    first_name: null,
    last_name: null,
    image_url: null,
    created_at: now,
    updated_at: now,
  });
}

describe("parseFeedbackRequest", () => {
  it("requires a non-empty trimmed message and source", () => {
    assert.throws(
      () => parseFeedbackRequest({ message: "   ", source: "footer" }),
      (error: unknown) =>
        error instanceof FeedbackServiceError && error.status === 400,
    );
    assert.throws(
      () => parseFeedbackRequest({ message: "hello", source: "wizard" }),
      (error: unknown) =>
        error instanceof FeedbackServiceError && error.status === 400,
    );
  });

  it("accepts a valid payload and trims the message", () => {
    const parsed = parseFeedbackRequest({
      message: "  Great product  ",
      source: "post_run",
      category: "praise",
      rating: 5,
      sessionId: "session-1",
      pageUrl: "https://example.com/run/session-1",
    });
    assert.equal(parsed.message, "Great product");
    assert.equal(parsed.source, "post_run");
    assert.equal(parsed.category, "praise");
    assert.equal(parsed.rating, 5);
    assert.equal(parsed.sessionId, "session-1");
  });

  it("rejects oversized messages", () => {
    assert.throws(
      () =>
        parseFeedbackRequest({
          message: "x".repeat(4001),
          source: "footer",
        }),
      (error: unknown) =>
        error instanceof FeedbackServiceError && error.status === 400,
    );
  });

  it("rejects invalid or oversized pageUrl values", () => {
    assert.throws(
      () =>
        parseFeedbackRequest({
          message: "hello",
          source: "footer",
          pageUrl: "javascript:alert(1)",
        }),
      (error: unknown) =>
        error instanceof FeedbackServiceError && error.status === 400,
    );
    assert.throws(
      () =>
        parseFeedbackRequest({
          message: "hello",
          source: "footer",
          pageUrl: `https://example.com/${"x".repeat(2100)}`,
        }),
      (error: unknown) =>
        error instanceof FeedbackServiceError && error.status === 400,
    );
  });
});

describe("buildFeedbackEmailContent", () => {
  it("includes run metadata without report bodies", () => {
    const content = buildFeedbackEmailContent({
      userId: USER_A,
      email: "user@example.com",
      submittedAt: "2026-07-11T12:00:00.000Z",
      request: {
        message: "Charts are hard to read",
        source: "post_run",
        category: "bug",
        rating: 2,
        pageUrl: "https://example.com/run/s1",
      },
      session: {
        id: "s1",
        status: "completed",
        ticker: "NVDA",
        analysisDate: "2026-07-11",
        decision: "Buy",
        error: null,
        runId: "run-1",
        createdAt: "2026-07-11T11:00:00.000Z",
        updatedAt: "2026-07-11T11:30:00.000Z",
        config: {
          ticker: "NVDA",
          analysisDate: "2026-07-11",
          outputLanguage: "English",
          analysts: ["market"],
          researchDepth: 1,
          llmProvider: "openai",
          quickThinkLlm: "gpt-4o-mini",
          deepThinkLlm: "gpt-4o",
        },
      },
    });

    assert.equal(content.subject, "[Feedback] NVDA — bug");
    assert.match(content.text, /Charts are hard to read/);
    assert.match(content.text, /Session: s1/);
    assert.match(content.text, /Provider: openai/);
    assert.doesNotMatch(content.text, /## Market Report/);
    assert.match(content.html, /Charts are hard to read/);
  });
});

describe("sendFeedbackEmail", () => {
  beforeEach(() => {
    resetFeedbackRateLimitForTests();
    process.env.RESEND_API_KEY = "re_test_key";
    process.env.FEEDBACK_TO_EMAIL = "jeff@bugfoot.net";
    process.env.FEEDBACK_FROM_EMAIL =
      "TradingAgents Feedback <onboarding@resend.dev>";
  });

  afterEach(() => {
    resetFeedbackRateLimitForTests();
    for (const [key, value] of Object.entries(ORIGINAL_ENV)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  });

  it("returns 503 when RESEND_API_KEY is missing", async () => {
    delete process.env.RESEND_API_KEY;
    const client = createInMemorySupabase();

    await assert.rejects(
      () =>
        sendFeedbackEmail(client, USER_A, {
          message: "hello",
          source: "footer",
        }),
      (error: unknown) =>
        error instanceof FeedbackServiceError &&
        error.status === 503 &&
        /RESEND_API_KEY/.test(error.message),
    );
  });

  it("returns 503 when FEEDBACK_FROM_EMAIL is missing", async () => {
    delete process.env.FEEDBACK_FROM_EMAIL;
    const client = createInMemorySupabase();

    await assert.rejects(
      () =>
        sendFeedbackEmail(
          client,
          USER_A,
          { message: "hello", source: "footer" },
          { sendEmail: async () => undefined },
        ),
      (error: unknown) =>
        error instanceof FeedbackServiceError &&
        error.status === 503 &&
        /FEEDBACK_FROM_EMAIL/.test(error.message),
    );
  });

  it("rejects feedback for another user's session", async () => {
    const client = createInMemorySupabase();
    await insertUser(client, USER_A, "a@example.com");
    await insertSession(client, "session-owned-by-b", USER_B, "AAPL");

    await assert.rejects(
      () =>
        sendFeedbackEmail(
          client,
          USER_A,
          {
            message: "Looks wrong",
            source: "post_run",
            sessionId: "session-owned-by-b",
          },
          {
            sendEmail: async () => {
              throw new Error("should not send");
            },
          },
        ),
      (error: unknown) =>
        error instanceof FeedbackServiceError && error.status === 404,
    );
  });

  it("sends email with Reply-To and session metadata", async () => {
    const client = createInMemorySupabase();
    await insertUser(client, USER_A, "owner@example.com");
    await insertSession(client, "session-a-1", USER_A, "MSFT");

    const sent: FeedbackEmailPayload[] = [];
    const result = await sendFeedbackEmail(
      client,
      USER_A,
      {
        message: "Love the Trade Check",
        source: "post_run",
        category: "praise",
        rating: 5,
        sessionId: "session-a-1",
        pageUrl: "https://app.example/run/session-a-1",
      },
      {
        sendEmail: async (payload) => {
          sent.push(payload);
        },
      },
    );

    assert.deepEqual(result, { ok: true });
    assert.equal(sent.length, 1);
    const payload = sent[0];
    assert.ok(payload);
    assert.equal(payload.to, "jeff@bugfoot.net");
    assert.equal(payload.replyTo, "owner@example.com");
    assert.equal(payload.subject, "[Feedback] MSFT — praise");
    assert.match(payload.text, /Love the Trade Check/);
    assert.match(payload.text, /Session: session-a-1/);
    assert.match(payload.text, /Ticker: MSFT/);
    assert.match(payload.text, /Analysts: market, news/);
  });

  it("omits Reply-To when the user has no email", async () => {
    const client = createInMemorySupabase();
    await insertUser(client, USER_A, null);

    const sent: FeedbackEmailPayload[] = [];
    await sendFeedbackEmail(
      client,
      USER_A,
      { message: "General note", source: "footer" },
      {
        sendEmail: async (payload) => {
          sent.push(payload);
        },
      },
    );

    assert.equal(sent.length, 1);
    const payload = sent[0];
    assert.ok(payload);
    assert.equal(payload.replyTo, undefined);
    assert.equal(payload.subject, "[Feedback] General — feedback");
  });

  it("rate limits repeated submissions from the same user", async () => {
    const client = createInMemorySupabase();
    await insertUser(client, USER_A, "owner@example.com");

    for (let i = 0; i < 5; i += 1) {
      await sendFeedbackEmail(
        client,
        USER_A,
        { message: `note ${i}`, source: "footer" },
        { sendEmail: async () => undefined },
      );
    }

    await assert.rejects(
      () =>
        sendFeedbackEmail(
          client,
          USER_A,
          { message: "one too many", source: "footer" },
          { sendEmail: async () => undefined },
        ),
      (error: unknown) =>
        error instanceof FeedbackServiceError && error.status === 429,
    );
  });
});
