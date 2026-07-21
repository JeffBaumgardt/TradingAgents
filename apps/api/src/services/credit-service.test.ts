/**
 * apps/api/src/services/credit-service.test.ts
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
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
        plan_id: "hosted",
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
        plan_id: "hosted",
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
        plan_id: "hosted",
        current_period_start: "2026-07-01T00:00:00.000Z",
        current_period_end: "2026-08-01T00:00:00.000Z",
      },
      new Date("2026-07-15T12:00:00.000Z"),
    );
    // Plenty of room above 3%, but not enough for a huge frontier estimate.
    await client
      .from("user_credit_periods")
      .update({ used_credits: period.base_allowance - 500_000 })
      .eq("id", period.id);

    const gate = await assertHostedCreditsForNewRun(
      client,
      userId,
      {
        plan_id: "hosted",
        current_period_start: "2026-07-01T00:00:00.000Z",
        current_period_end: "2026-08-01T00:00:00.000Z",
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
      "hosted",
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

  it("blocks new hosted runs below the 3% remaining threshold", async () => {
    const client = createInMemorySupabase();
    const userId = "user-credit-block";
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
        plan_id: "hosted",
        current_period_start: "2026-07-01T00:00:00.000Z",
        current_period_end: "2026-08-01T00:00:00.000Z",
      },
      new Date("2026-07-15T12:00:00.000Z"),
    );
    await client
      .from("user_credit_periods")
      .update({ used_credits: period.base_allowance - 100_000 })
      .eq("id", period.id);

    const gate = await assertHostedCreditsForNewRun(
      client,
      userId,
      {
        plan_id: "hosted",
        current_period_start: "2026-07-01T00:00:00.000Z",
        current_period_end: "2026-08-01T00:00:00.000Z",
      },
      {
        ticker: "AAPL",
        analysisDate: "2026-07-01",
        analysts: ["market", "news", "social", "fundamentals"],
        researchDepth: 3,
        llmProvider: "openai",
        thinkLlm: "gpt-5.5",
        outputLanguage: "English",
      },
      "hosted",
    );

    assert.equal(gate.allowed, false);
    assert.equal(gate.code, "credits_insufficient");
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
    await client.from("model_credit_multipliers").upsert({
      provider_id: "openai",
      model_id: "gpt-5.5",
      display_name: "GPT-5.5",
      provider_label: "OpenAI",
      input_usd_per_1m: 5,
      output_usd_per_1m: 30,
      credit_multiplier: 100,
      modes: ["deep"],
      notes: null,
      is_active: true,
      updated_at: new Date().toISOString(),
    });

    await ensureCreditPeriod(
      client,
      userId,
      {
        plan_id: "hosted",
        current_period_start: "2026-07-01T00:00:00.000Z",
        current_period_end: "2026-08-01T00:00:00.000Z",
      },
      new Date("2026-07-15T12:00:00.000Z"),
    );
    await initSessionUsageCursor(client, {
      sessionId,
      userId,
      providerId: "openai",
      quickModelId: "gpt-5.5",
      deepModelId: "gpt-5.5",
      costSource: "hosted",
    });

    const first = await meterSessionStats(client, {
      sessionId,
      userId,
      tokensIn: 10,
      tokensOut: 10,
      subscription: {
        plan_id: "hosted",
        current_period_start: "2026-07-01T00:00:00.000Z",
        current_period_end: "2026-08-01T00:00:00.000Z",
      },
    });
    assert.equal(first.chargedCredits, 2000);
    assert.equal(first.sessionCredits, 2000);

    const second = await meterSessionStats(client, {
      sessionId,
      userId,
      tokensIn: 10,
      tokensOut: 10,
      subscription: {
        plan_id: "hosted",
        current_period_start: "2026-07-01T00:00:00.000Z",
        current_period_end: "2026-08-01T00:00:00.000Z",
      },
    });
    assert.equal(second.chargedCredits, 0);
    assert.equal(second.sessionCredits, 2000);

    const estimated = await estimateRunCredits(
      client,
      {
        ticker: "AAPL",
        analysisDate: "2026-07-01",
        analysts: ["market"],
        researchDepth: 1,
        llmProvider: "openai",
        thinkLlm: "gpt-5.5",
        outputLanguage: "English",
      },
      "hosted",
    );
    assert.ok(estimated > 0);
  });

  it("does not charge credits for self_pay traffic", async () => {
    const client = createInMemorySupabase();
    const userId = "user-selfpay";
    const sessionId = "session-selfpay";
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
    await initSessionUsageCursor(client, {
      sessionId,
      userId,
      providerId: "openai",
      quickModelId: "gpt-5.5",
      deepModelId: "gpt-5.5",
      costSource: "self_pay",
    });

    const meter = await meterSessionStats(client, {
      sessionId,
      userId,
      tokensIn: 1000,
      tokensOut: 1000,
      subscription: {
        plan_id: "hosted",
        current_period_start: "2026-07-01T00:00:00.000Z",
        current_period_end: "2026-08-01T00:00:00.000Z",
      },
    });
    assert.equal(meter.chargedCredits, 0);
    assert.equal(meter.costSource, "self_pay");
  });
});
