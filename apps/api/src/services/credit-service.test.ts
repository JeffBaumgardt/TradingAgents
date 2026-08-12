/**
 * apps/api/src/services/credit-service.test.ts
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { CreateSessionRequest } from "@tradingagents/api-types";
import { createInMemorySupabase } from "@tradingagents/supabase/test";
import {
  assertHostedCreditsForNewRun,
  computeRolloverCredits,
  ensureCreditPeriod,
  estimateRunCredits,
  initSessionUsageCursor,
  meterSessionStats,
} from "./credit-service.js";

describe("credit-service", () => {
  it("rolls over unused base credits from the previous period only", () => {
    assert.equal(
      computeRolloverCredits(
        {
          id: 1,
          user_id: "u",
          period_start: "2026-05-01T00:00:00.000Z",
          period_end: "2026-06-01T00:00:00.000Z",
          base_allowance: 10_000_000,
          rollover_credits: 4_000_000,
          used_credits: 2_000_000,
          blocked_low_balance: false,
          created_at: "",
          updated_at: "",
        },
        1,
      ),
      8_000_000,
    );
    assert.equal(
      computeRolloverCredits(
        {
          id: 1,
          user_id: "u",
          period_start: "2026-05-01T00:00:00.000Z",
          period_end: "2026-06-01T00:00:00.000Z",
          base_allowance: 10_000_000,
          rollover_credits: 4_000_000,
          used_credits: 2_000_000,
          blocked_low_balance: false,
          created_at: "",
          updated_at: "",
        },
        0,
      ),
      0,
    );
  });

  it("creates a credit period with prior-month rollover", async () => {
    const client = createInMemorySupabase();
    const userId = "user-credit-1";
    await client.from("users").insert({
      id: userId,
      email: "a@b.c",
      first_name: null,
      last_name: null,
      image_url: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    const june = await ensureCreditPeriod(
      client,
      userId,
      {
        plan_id: "pro",
        current_period_start: "2026-01-01T00:00:00.000Z",
        current_period_end: "2027-01-01T00:00:00.000Z",
      },
      new Date("2026-06-15T12:00:00.000Z"),
    );
    assert.equal(june.period_start, "2026-06-01T00:00:00.000Z");
    await client
      .from("user_credit_periods")
      .update({ used_credits: 1_000_000 })
      .eq("id", june.id);

    const next = await ensureCreditPeriod(
      client,
      userId,
      {
        plan_id: "pro",
        current_period_start: "2026-01-01T00:00:00.000Z",
        current_period_end: "2027-01-01T00:00:00.000Z",
      },
      new Date("2026-07-15T12:00:00.000Z"),
    );

    assert.equal(next.period_start, "2026-07-01T00:00:00.000Z");
    assert.equal(next.base_allowance, 10_000_000);
    assert.equal(next.rollover_credits, 9_000_000);
    assert.equal(next.used_credits, 0);
  });

  it("uses monthly credit windows inside an annual Stripe period", async () => {
    const { resolveMonthlyCreditWindow } = await import("./credit-service.js");
    const window = resolveMonthlyCreditWindow({
      subscriptionPeriodStart: "2026-01-15T00:00:00.000Z",
      subscriptionPeriodEnd: "2027-01-15T00:00:00.000Z",
      now: new Date("2026-07-20T12:00:00.000Z"),
    });
    assert.equal(window.periodStart, "2026-07-15T00:00:00.000Z");
    assert.equal(window.periodEnd, "2026-08-15T00:00:00.000Z");
  });

  it("rejects an oversized run without latching the period closed", async () => {
    const client = createInMemorySupabase();
    const userId = "user-credit-estimate";
    await client.from("users").insert({
      id: userId,
      email: null,
      first_name: null,
      last_name: null,
      image_url: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    const period = await ensureCreditPeriod(
      client,
      userId,
      {
        plan_id: "pro",
        current_period_start: "2026-08-01T00:00:00.000Z",
        current_period_end: "2026-09-01T00:00:00.000Z",
      },
      new Date("2026-08-11T18:00:00.000Z"),
    );
    // Above the 3% block floor (300k) but below a depth-5 preflight (~550k).
    await client
      .from("user_credit_periods")
      .update({ used_credits: period.base_allowance - 400_000 })
      .eq("id", period.id);

    const gate = await assertHostedCreditsForNewRun(
      client,
      userId,
      {
        plan_id: "pro",
        current_period_start: "2026-08-01T00:00:00.000Z",
        current_period_end: "2026-09-01T00:00:00.000Z",
      },
      {
        ticker: "AAPL",
        analysisDate: "2026-07-01",
        analysts: ["market", "news", "social", "fundamentals"],
        researchDepth: 5,
        llmProvider: "openai",
        thinkLlm: "gpt-5.5",
        outputLanguage: "English",
      },
    );

    assert.equal(gate.allowed, false);
    assert.equal(gate.code, "credits_insufficient");
    const { data } = await client
      .from("user_credit_periods")
      .select("blocked_low_balance")
      .eq("id", period.id)
      .maybeSingle();
    assert.equal((data as { blocked_low_balance: boolean }).blocked_low_balance, false);
  });

  it("rejects a second hosted run when in-flight estimates exhaust remaining credits", async () => {
    const client = createInMemorySupabase();
    const userId = "user-credit-inflight";
    const sessionId = "session-inflight";
    await client.from("users").insert({
      id: userId,
      email: null,
      first_name: null,
      last_name: null,
      image_url: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    const subscription = {
      plan_id: "pro",
      current_period_start: "2099-07-01T00:00:00.000Z",
      current_period_end: "2099-08-01T00:00:00.000Z",
    } as const;

    const period = await ensureCreditPeriod(
      client,
      userId,
      subscription,
      new Date("2099-07-15T12:00:00.000Z"),
    );

    const runBody: CreateSessionRequest = {
      ticker: "AAPL",
      analysisDate: "2026-07-01",
      analysts: ["market", "news", "social", "fundamentals"],
      researchDepth: 5,
      llmProvider: "openai",
      thinkLlm: "gpt-5.5",
      outputLanguage: "English",
    };

    const estimate = await estimateRunCredits(client, runBody);
    // Leave enough for one estimate, but not two concurrent ones.
    await client
      .from("user_credit_periods")
      .update({ used_credits: Math.max(0, period.base_allowance - estimate - 1_000) })
      .eq("id", period.id);

    await client.from("sessions").insert({
      id: sessionId,
      user_id: userId,
      ticker: "AAPL",
      analysis_date: "2026-07-01",
      status: "pending",
      config: runBody,
      run_id: null,
      report_markdown: null,
      report_sections: null,
      decision: null,
      error: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    await initSessionUsageCursor(client, {
      sessionId,
      userId,
      providerId: "openai",
      quickModelId: "gpt-5.5",
      deepModelId: "gpt-5.5",
    });

    const gate = await assertHostedCreditsForNewRun(
      client,
      userId,
      subscription,
      runBody,
    );

    assert.equal(gate.allowed, false);
    assert.equal(gate.code, "credits_insufficient");
    assert.match(gate.message ?? "", /in-flight|in progress/i);
  });

  it("rejects post-insert when concurrent pending hosted estimates exceed remaining", async () => {
    const client = createInMemorySupabase();
    const userId = "user-credit-inflight-over";
    await client.from("users").insert({
      id: userId,
      email: null,
      first_name: null,
      last_name: null,
      image_url: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    const subscription = {
      plan_id: "pro",
      current_period_start: "2099-07-01T00:00:00.000Z",
      current_period_end: "2099-08-01T00:00:00.000Z",
    } as const;

    const period = await ensureCreditPeriod(
      client,
      userId,
      subscription,
      new Date("2099-07-15T12:00:00.000Z"),
    );

    const runBody: CreateSessionRequest = {
      ticker: "AAPL",
      analysisDate: "2026-07-01",
      analysts: ["market", "news", "social", "fundamentals"],
      researchDepth: 5,
      llmProvider: "openai",
      thinkLlm: "gpt-5.5",
      outputLanguage: "English",
    };
    const estimate = await estimateRunCredits(client, runBody);
    await client
      .from("user_credit_periods")
      .update({ used_credits: Math.max(0, period.base_allowance - estimate - 1_000) })
      .eq("id", period.id);

    for (const sessionId of ["session-a", "session-b"]) {
      await client.from("sessions").insert({
        id: sessionId,
        user_id: userId,
        ticker: "AAPL",
        analysis_date: "2026-07-01",
        status: "pending",
        config: runBody,
        run_id: null,
        report_markdown: null,
        report_sections: null,
        decision: null,
        error: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      await initSessionUsageCursor(client, {
        sessionId,
        userId,
        providerId: "openai",
        quickModelId: "gpt-5.5",
        deepModelId: "gpt-5.5",
      });
    }

    const { assertHostedInFlightWithinBalance } = await import("./credit-service.js");
    const within = await assertHostedInFlightWithinBalance(client, userId, subscription);
    assert.equal(within.allowed, false);
    assert.equal(within.code, "credits_insufficient");
  });

  it("meters token deltas into usage_events and charges hosted credits", async () => {
    const client = createInMemorySupabase();
    const userId = "user-meter";
    const sessionId = "session-meter";
    await client.from("users").insert({
      id: userId,
      email: null,
      first_name: null,
      last_name: null,
      image_url: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    await client.from("sessions").insert({
      id: sessionId,
      user_id: userId,
      ticker: "AAPL",
      analysis_date: "2026-07-01",
      status: "running",
      config: {},
      run_id: null,
      report_markdown: null,
      report_sections: null,
      decision: null,
      error: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    await ensureCreditPeriod(
      client,
      userId,
      {
        plan_id: "pro",
        current_period_start: "2099-07-01T00:00:00.000Z",
        current_period_end: "2099-08-01T00:00:00.000Z",
      },
      new Date("2099-07-15T12:00:00.000Z"),
    );
    await initSessionUsageCursor(client, {
      sessionId,
      userId,
      providerId: "anthropic",
      quickModelId: "claude-sonnet-5",
      deepModelId: "claude-sonnet-5",
    });

    // 10 in × 1.05 + 10 out × 5.25 = 63 credits
    const first = await meterSessionStats(client, {
      sessionId,
      userId,
      tokensIn: 10,
      tokensOut: 10,
      subscription: {
        plan_id: "pro",
        current_period_start: "2099-07-01T00:00:00.000Z",
        current_period_end: "2099-08-01T00:00:00.000Z",
      },
    });
    assert.equal(first.chargedCredits, 63);
    assert.equal(first.sessionCredits, 63);

    const second = await meterSessionStats(client, {
      sessionId,
      userId,
      tokensIn: 10,
      tokensOut: 10,
      subscription: {
        plan_id: "pro",
        current_period_start: "2099-07-01T00:00:00.000Z",
        current_period_end: "2099-08-01T00:00:00.000Z",
      },
    });
    assert.equal(second.chargedCredits, 0);
    assert.equal(second.sessionCredits, 63);

    await client.from("session_usage_cursors").delete().eq("session_id", sessionId);
    const afterCursorDeleted = await meterSessionStats(client, {
      sessionId,
      userId,
      tokensIn: 10,
      tokensOut: 10,
      subscription: {
        plan_id: "pro",
        current_period_start: "2099-07-01T00:00:00.000Z",
        current_period_end: "2099-08-01T00:00:00.000Z",
      },
    });
    assert.equal(afterCursorDeleted.chargedCredits, 0);
    assert.equal(afterCursorDeleted.sessionCredits, 63);
    assert.ok(afterCursorDeleted.remaining != null);

    const estimated = await estimateRunCredits(client, {
      ticker: "AAPL",
      analysisDate: "2026-07-01",
      analysts: ["market"],
      researchDepth: 1,
      llmProvider: "anthropic",
      thinkLlm: "claude-sonnet-5",
      outputLanguage: "English",
    });
    assert.ok(estimated > 0);
  });
});
