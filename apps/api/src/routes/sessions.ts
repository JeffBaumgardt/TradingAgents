/**
 * apps/api/src/routes/sessions.ts
 *
 * Session CRUD, report retrieval, and SSE streaming endpoints.
 *
 * Share-by-link reads (GET session / report / trade-check) are public: the
 * session UUID is the capability. Mutations, event history, and live streams
 * still require a verified Clerk session and are scoped to the owner.
 *
 * Note: anonymous GET must stay free of requireUserId() — share links depend on it.
 */

import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import type { CreateSessionRequest, PostChatMessageRequest } from "@tradingagents/api-types";
import { formatSseEvent } from "@tradingagents/utils";
import { getSupabaseAdmin } from "@tradingagents/supabase";
import { requireUserId, getRequestUserId, optionalUserId, getOptionalRequestUserId } from "../middleware/user-context.js";
import { cancelChatTurn, cancelRun, getChatTurnStreamUrl, getRunStreamUrl, fetchRunStatus } from "../services/agents-client.js";
import {
  getBillingAccount,
  userHasActiveSubscription,
} from "../services/billing-account-service.js";
import * as chatService from "../services/chat-service.js";
import { meterSessionStats } from "../services/credit-service.js";
import * as sessionService from "../services/session-service.js";
import { SessionServiceError } from "../services/session-service.js";

export const sessionRoutes = new Hono();

function sessionIdParam(c: { req: { param: (key: string) => string | undefined } }): string {
  const id = c.req.param("id");
  if (!id) {
    throw new Error("Missing session id");
  }
  return id;
}

async function relayRunError(
  stream: Parameters<Parameters<typeof streamSSE>[1]>[0],
  client: ReturnType<typeof getSupabaseAdmin>,
  sessionId: string,
  message: string,
  hint?: string,
): Promise<void> {
  const payload = {
    message,
    ...(hint ? { hint } : {}),
  };
  await stream.writeSSE({
    event: "run.error",
    data: JSON.stringify(payload),
  });
  await sessionService.persistEvent(client, sessionId, "run.error", payload);
  await sessionService.markSessionError(client, sessionId, message);
}

async function relayAgentsFrame(
  stream: Parameters<Parameters<typeof streamSSE>[1]>[0],
  client: ReturnType<typeof getSupabaseAdmin>,
  sessionId: string,
  userId: string,
  eventType: string,
  dataLine: string,
  options?: {
    runId?: string | null;
    costSource?: "hosted" | "self_pay" | null;
    subscription?: {
      plan_id: string;
      current_period_start: string;
      current_period_end: string;
    } | null;
  },
): Promise<boolean> {
  let outboundData = dataLine;

  if (eventType === "stats") {
    try {
      const payload = JSON.parse(dataLine) as Record<string, unknown>;
      const tokensIn = typeof payload.tokens_in === "number" ? payload.tokens_in : 0;
      const tokensOut = typeof payload.tokens_out === "number" ? payload.tokens_out : 0;
      const meter = await meterSessionStats(client, {
        sessionId,
        userId,
        tokensIn,
        tokensOut,
        subscription: options?.subscription ?? null,
      });

      const enriched = {
        ...payload,
        compute_credits: meter.sessionCredits,
        ...(meter.remaining != null
          ? { remaining_compute_credits: meter.remaining }
          : {}),
      };
      outboundData = JSON.stringify(enriched);

      await stream.writeSSE({ event: eventType, data: outboundData });
      await sessionService.persistEvent(client, sessionId, eventType, enriched);

      if (meter.shouldWarn && meter.warnMessage && meter.remaining != null && meter.totalAllowance != null) {
        const warning = {
          remainingComputeCredits: meter.remaining,
          totalAllowanceComputeCredits: meter.totalAllowance,
          usedRatio: meter.usedRatio ?? 0,
          message: meter.warnMessage,
        };
        await stream.writeSSE({
          event: "credit.warning",
          data: JSON.stringify(warning),
        });
        await sessionService.persistEvent(client, sessionId, "credit.warning", warning);
      }

      if (meter.exhausted && meter.costSource === "hosted") {
        const exhausted = {
          remainingComputeCredits: meter.remaining ?? 0,
          message: "Compute credits exhausted — this run has been stopped.",
          hint: "Partial results below are still available. Hosted runs resume when your allowance resets (or after a one-time credit top-up when available).",
        };
        await stream.writeSSE({
          event: "credit.exhausted",
          data: JSON.stringify(exhausted),
        });
        await sessionService.persistEvent(client, sessionId, "credit.exhausted", exhausted);

        if (options?.runId) {
          try {
            await cancelRun(options.runId, {
              message: exhausted.message,
              hint: exhausted.hint,
            });
          } catch {
            // Best-effort stop; we still fail the session locally.
          }
        }

        await relayRunError(stream, client, sessionId, exhausted.message, exhausted.hint);
        return true;
      }

      return false;
    } catch (error) {
      // Fail closed only when this run is spending platform credits.
      const isHostedSpend = options?.costSource === "hosted";
      if (isHostedSpend) {
        const message = "Run stopped because credit metering failed.";
        const hint = error instanceof Error ? error.message : "Unknown metering error";
        if (options?.runId) {
          try {
            await cancelRun(options.runId, { message, hint });
          } catch {
            // Best-effort.
          }
        }
        await relayRunError(stream, client, sessionId, message, hint);
        return true;
      }
      // Self-pay: relay the raw stats frame without enrichment.
    }
  }

  await stream.writeSSE({ event: eventType, data: outboundData });

  try {
    const payload = JSON.parse(outboundData) as Record<string, unknown>;
    await sessionService.persistEvent(client, sessionId, eventType, payload);

    if (eventType === "report.section") {
      const section = typeof payload.section === "string" ? payload.section : null;
      const content = typeof payload.content === "string" ? payload.content : null;
      if (section && content) {
        await sessionService.persistReportSection(client, sessionId, section, content);
      }
    }

    if (eventType === "trade.check") {
      const tradeCheck = payload.tradeCheck;
      if (tradeCheck && typeof tradeCheck === "object") {
        await sessionService.persistTradeCheck(
          client,
          sessionId,
          tradeCheck as Record<string, unknown>,
        );
      }
    }

    if (eventType === "run.completed") {
      const report = await sessionService.getSessionReport(client, sessionId, userId);
      if (report !== "not_found" && report !== "not_ready") {
        await sessionService.markSessionCompleted(client, sessionId, {
          markdown: report.markdown,
          sections: report.sections,
          decision: report.decision,
          tradeCheck: report.tradeCheck as Record<string, unknown> | null | undefined,
        });
      }
      return true;
    }

    if (eventType === "run.error") {
      const message =
        typeof payload.message === "string" ? payload.message : "Run failed";
      await sessionService.markSessionError(client, sessionId, message);
      return true;
    }
  } catch {
    await sessionService.persistEvent(client, sessionId, eventType, { raw: dataLine });
  }

  return false;
}

sessionRoutes.get("/sessions", requireUserId(), async (c) => {
  const userId = getRequestUserId(c);
  const limit = Number(c.req.query("limit") ?? "20");
  const offset = Number(c.req.query("offset") ?? "0");
  const client = getSupabaseAdmin(c);
  const result = await sessionService.listSessions(client, userId, limit, offset);
  return c.json(result);
});

sessionRoutes.post("/sessions", requireUserId(), async (c) => {
  const body = (await c.req.json()) as CreateSessionRequest;
  const userId = getRequestUserId(c);
  const client = getSupabaseAdmin(c);

  const account = await getBillingAccount(client, userId);
  if (!userHasActiveSubscription(account.subscription)) {
    return c.json(
      {
        error: "An active subscription is required to start an analysis run.",
        code: "subscription_required",
      },
      402,
    );
  }

  try {
    const session = await sessionService.createSession(client, body, userId);
    return c.json(session, 201);
  } catch (error) {
    if (error instanceof sessionService.SessionServiceError) {
      return c.json(
        { error: error.message, code: error.code },
        error.status as 400 | 402 | 500,
      );
    }
    const message = error instanceof Error ? error.message : "Invalid request";
    return c.json({ error: message }, 400);
  }
});

/** Public share-by-link: session UUID is the capability (no ownership check). */
sessionRoutes.get("/sessions/:id", optionalUserId(), async (c) => {
  const client = getSupabaseAdmin(c);
  const session = await sessionService.getSession(client, sessionIdParam(c));
  if (!session) {
    return c.json({ error: "Session not found" }, 404);
  }

  const requesterId = getOptionalRequestUserId(c);
  if (requesterId && session.userId === requesterId) {
    return c.json(session);
  }

  return c.json(sessionService.toShareSession(session));
});

sessionRoutes.delete("/sessions/:id", requireUserId(), async (c) => {
  const userId = getRequestUserId(c);
  const client = getSupabaseAdmin(c);
  try {
    const deleted = await sessionService.deleteSession(client, sessionIdParam(c), userId);
    if (!deleted) {
      return c.json({ error: "Session not found" }, 404);
    }
    return c.body(null, 204);
  } catch (error) {
    if (error instanceof sessionService.SessionServiceError) {
      return c.json(
        { error: error.message, code: error.code },
        error.status as 400 | 402 | 409 | 500,
      );
    }
    throw error;
  }
});

/** Public share-by-link: final agent report for a completed run. */
sessionRoutes.get("/sessions/:id/report", optionalUserId(), async (c) => {
  const id = sessionIdParam(c);
  const client = getSupabaseAdmin(c);
  const requesterId = getOptionalRequestUserId(c);
  const report = await sessionService.getSessionReport(client, id, undefined, {
    allowSideEffects: false,
    ...(requesterId ? { requesterId } : {}),
  });

  if (report === "not_found") {
    return c.json({ error: "Session not found" }, 404);
  }
  if (report === "not_ready") {
    return c.json({ error: "Report not ready" }, 409);
  }

  return c.json(report);
});

/** Public share-by-link: Trade Check chart payload. */
sessionRoutes.get("/sessions/:id/trade-check", optionalUserId(), async (c) => {
  const id = sessionIdParam(c);
  const client = getSupabaseAdmin(c);
  const requesterId = getOptionalRequestUserId(c);
  const tradeCheck = await sessionService.getSessionTradeCheck(client, id, undefined, {
    allowSideEffects: false,
    ...(requesterId ? { requesterId } : {}),
  });

  if (tradeCheck === "not_found") {
    return c.json({ error: "Session not found" }, 404);
  }
  if (tradeCheck === "not_ready") {
    return c.json({ error: "Trade Check not ready" }, 409);
  }
  if (tradeCheck === "unavailable") {
    return c.json({ error: "Trade Check not available for this session" }, 404);
  }

  return c.json(tradeCheck);
});

sessionRoutes.get("/sessions/:id/events", requireUserId(), async (c) => {
  const userId = getRequestUserId(c);
  const id = sessionIdParam(c);
  const client = getSupabaseAdmin(c);
  const session = await sessionService.getSession(client, id, userId);

  if (!session) {
    return c.json({ error: "Session not found" }, 404);
  }

  const stored = await sessionService.getStoredEvents(client, id);
  return c.json({
    items: stored.map((event) => ({
      id: event.id,
      type: event.type,
      payload: event.payload,
      createdAt: event.created_at,
    })),
  });
});

sessionRoutes.get("/sessions/:id/stream", requireUserId(), async (c) => {
  const userId = getRequestUserId(c);
  const id = sessionIdParam(c);
  const client = getSupabaseAdmin(c);
  const session = await sessionService.getSession(client, id, userId);

  if (!session) {
    return c.json({ error: "Session not found" }, 404);
  }

  if (!session.runId) {
    return c.json({ error: "Session has no associated run" }, 409);
  }

  return streamSSE(c, async (stream) => {
    const liveOnly = c.req.query("live") === "1" || c.req.query("live") === "true";
    let sawTerminalEvent = false;

    const account = await getBillingAccount(client, userId);
    const creditSubscription =
      account.subscription.planId === "hosted" &&
      account.subscription.currentPeriodStart &&
      account.subscription.currentPeriodEnd
        ? {
            plan_id: "hosted",
            current_period_start: account.subscription.currentPeriodStart,
            current_period_end: account.subscription.currentPeriodEnd,
          }
        : null;

    const { data: cursorRow } = await client
      .from("session_usage_cursors")
      .select("cost_source")
      .eq("session_id", id)
      .maybeSingle();
    const costSource =
      (cursorRow as { cost_source?: string } | null)?.cost_source === "hosted"
        ? ("hosted" as const)
        : ("self_pay" as const);

    if (!liveOnly) {
      const stored = await sessionService.getStoredEvents(client, id);
      for (const event of stored) {
        await stream.writeSSE({
          event: event.type,
          data: JSON.stringify(event.payload),
        });
        if (event.type === "run.completed" || event.type === "run.error") {
          sawTerminalEvent = true;
        }
      }
    }

    if (
      session.status === "completed" ||
      session.status === "error" ||
      session.status === "cancelled" ||
      sawTerminalEvent
    ) {
      return;
    }

    let response: Response;
    try {
      response = await fetch(getRunStreamUrl(session.runId!));
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to connect to agents stream";
      await relayRunError(
        stream,
        client,
        id,
        message,
        "Could not reach the agents service. Check AGENTS_SERVICE_URL and redeploy if needed.",
      );
      return;
    }

    if (!response.ok || !response.body) {
      await relayRunError(
        stream,
        client,
        id,
        "Failed to connect to agents stream",
        response.status === 404
          ? "The run is no longer available on the agents service (often after a redeploy). Start a new analysis."
          : "Verify the API can reach the Python agents-service on port 8000.",
      );
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    const frameOptions = {
      runId: session.runId,
      costSource,
      subscription: costSource === "hosted" ? creditSubscription : null,
    };

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const frames = buffer.split("\n\n");
      buffer = frames.pop() ?? "";

      for (const frame of frames) {
        if (!frame.trim()) {
          continue;
        }

        let eventType = "message";
        let dataLine = "";

        for (const line of frame.split("\n")) {
          if (line.startsWith("event:")) {
            eventType = line.slice(6).trim();
          } else if (line.startsWith("data:")) {
            dataLine = line.slice(5).trim();
          }
        }

        if (!dataLine) {
          continue;
        }

        const terminal = await relayAgentsFrame(
          stream,
          client,
          id,
          userId,
          eventType,
          dataLine,
          frameOptions,
        );
        if (terminal) {
          sawTerminalEvent = true;
          try {
            await reader.cancel();
          } catch {
            // Ignore cancel errors when stopping for credits.
          }
          return;
        }
      }
    }

    if (buffer.trim()) {
      await stream.write(formatSseEvent("message", { raw: buffer }));
    }

    if (sawTerminalEvent) {
      return;
    }

    const runStatus = await fetchRunStatus(session.runId!);
    if (!runStatus) {
      await relayRunError(
        stream,
        client,
        id,
        "Run not found on agents service",
        "The analysis worker may have restarted. Start a new run.",
      );
      return;
    }

    if (runStatus.status === "completed") {
      await relayAgentsFrame(
        stream,
        client,
        id,
        userId,
        "run.completed",
        JSON.stringify({
          sessionId: id,
          decision: null,
        }),
        frameOptions,
      );
      return;
    }

    if (runStatus.status === "error" || runStatus.status === "cancelled") {
      await relayRunError(
        stream,
        client,
        id,
        runStatus.error ?? "Run failed",
        runStatus.status === "cancelled" ? "This analysis was cancelled." : undefined,
      );
    }
  });
});

/** Public share-by-link: follow-up chat transcript (read-only for non-owners). */
sessionRoutes.get("/sessions/:id/chat", optionalUserId(), async (c) => {
  const client = getSupabaseAdmin(c);
  const requesterId = getOptionalRequestUserId(c);
  const result = await chatService.listChatMessages(client, sessionIdParam(c), {
    requesterId: requesterId ?? null,
  });
  if (result === "not_found") {
    return c.json({ error: "Session not found" }, 404);
  }
  return c.json(result);
});

sessionRoutes.post("/sessions/:id/chat/messages", requireUserId(), async (c) => {
  const userId = getRequestUserId(c);
  const client = getSupabaseAdmin(c);
  const body = (await c.req.json()) as PostChatMessageRequest;
  try {
    const result = await chatService.postChatMessage(
      client,
      sessionIdParam(c),
      userId,
      body.content ?? "",
    );
    return c.json(result, 201);
  } catch (error) {
    if (error instanceof SessionServiceError) {
      return c.json(
        { error: error.message, code: error.code },
        error.status as 400 | 402 | 404 | 409 | 503,
      );
    }
    const message = error instanceof Error ? error.message : "Invalid request";
    return c.json({ error: message }, 400);
  }
});

sessionRoutes.get("/sessions/:id/chat/stream", requireUserId(), async (c) => {
  const userId = getRequestUserId(c);
  const id = sessionIdParam(c);
  const turnId = c.req.query("turnId");
  if (!turnId) {
    return c.json({ error: "turnId query parameter is required" }, 400);
  }

  const client = getSupabaseAdmin(c);
  const session = await sessionService.getSession(client, id, userId);
  if (!session) {
    return c.json({ error: "Session not found" }, 404);
  }

  const turn = await chatService.getOwnedChatTurn(client, {
    sessionId: id,
    userId,
    turnId,
  });
  if (!turn) {
    return c.json({ error: "Chat turn not found for this session" }, 404);
  }

  const account = await getBillingAccount(client, userId);
  const creditSubscription =
    account.subscription.planId === "hosted" &&
    account.subscription.currentPeriodStart &&
    account.subscription.currentPeriodEnd
      ? {
          plan_id: "hosted",
          current_period_start: account.subscription.currentPeriodStart,
          current_period_end: account.subscription.currentPeriodEnd,
        }
      : null;

  const { data: cursorRow } = await client
    .from("session_usage_cursors")
    .select("cost_source")
    .eq("session_id", id)
    .maybeSingle();
  const costSource =
    (cursorRow as { cost_source?: string } | null)?.cost_source === "hosted"
      ? ("hosted" as const)
      : ("self_pay" as const);

  return streamSSE(c, async (stream) => {
    let response: Response;
    try {
      response = await fetch(getChatTurnStreamUrl(turnId));
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to connect to chat stream";
      await stream.writeSSE({
        event: "chat.error",
        data: JSON.stringify({
          turnId,
          sessionId: id,
          message,
        }),
      });
      return;
    }

    if (!response.ok || !response.body) {
      await stream.writeSSE({
        event: "chat.error",
        data: JSON.stringify({
          turnId,
          sessionId: id,
          message: `Chat stream unavailable (${response.status})`,
        }),
      });
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      buffer += decoder.decode(value, { stream: true });
      const frames = buffer.split("\n\n");
      buffer = frames.pop() ?? "";

      for (const frame of frames) {
        if (!frame.trim()) {
          continue;
        }
        let eventType = "message";
        let dataLine = "";
        for (const line of frame.split("\n")) {
          if (line.startsWith("event:")) {
            eventType = line.slice(6).trim();
          } else if (line.startsWith("data:")) {
            dataLine = line.slice(5).trim();
          }
        }
        if (!dataLine) {
          continue;
        }

        let outboundData = dataLine;
        if (eventType === "stats") {
          try {
            const payload = JSON.parse(dataLine) as Record<string, unknown>;
            const tokensIn = typeof payload.tokens_in === "number" ? payload.tokens_in : 0;
            const tokensOut = typeof payload.tokens_out === "number" ? payload.tokens_out : 0;
            const meter = await meterSessionStats(client, {
              sessionId: id,
              userId,
              tokensIn,
              tokensOut,
              subscription: creditSubscription,
            });
            outboundData = JSON.stringify({
              ...payload,
              compute_credits: meter.sessionCredits,
              ...(meter.remaining != null
                ? { remaining_compute_credits: meter.remaining }
                : {}),
            });

            await stream.writeSSE({ event: eventType, data: outboundData });

            if (meter.shouldWarn && meter.warnMessage && meter.remaining != null && meter.totalAllowance != null) {
              await stream.writeSSE({
                event: "credit.warning",
                data: JSON.stringify({
                  remainingComputeCredits: meter.remaining,
                  totalAllowanceComputeCredits: meter.totalAllowance,
                  usedRatio: meter.usedRatio ?? 0,
                  message: meter.warnMessage,
                }),
              });
            }

            if (meter.exhausted && costSource === "hosted") {
              const exhausted = {
                remainingComputeCredits: meter.remaining ?? 0,
                message: "Compute credits exhausted — this chat turn has been stopped.",
                hint: "Prior research and chat history remain available.",
              };
              await stream.writeSSE({
                event: "credit.exhausted",
                data: JSON.stringify(exhausted),
              });
              try {
                await cancelChatTurn(turnId, {
                  message: exhausted.message,
                  hint: exhausted.hint,
                });
              } catch {
                // Best-effort.
              }
              return;
            }
            continue;
          } catch {
            // Fall through and relay raw stats for self-pay.
          }
        }

        await stream.writeSSE({ event: eventType, data: outboundData });

        if (eventType === "chat.completed" || eventType === "chat.error") {
          try {
            const payload = JSON.parse(outboundData) as Record<string, unknown>;
            const assistantMessageId =
              typeof payload.assistantMessageId === "string"
                ? payload.assistantMessageId
                : null;
            if (assistantMessageId) {
              await chatService.finalizeAssistantFromStream(
                client,
                assistantMessageId,
                id,
                payload,
                eventType === "chat.completed" ? "completed" : "error",
              );
            }
          } catch {
            // Background meter also finalizes; this is a belt-and-suspenders path.
          }
          return;
        }
      }
    }
  });
});

/** Public: download research + chat as markdown (clipboard-limit workaround). */
sessionRoutes.get("/sessions/:id/export.md", optionalUserId(), async (c) => {
  const client = getSupabaseAdmin(c);
  const markdown = await chatService.buildSessionExportMarkdown(client, sessionIdParam(c));
  if (markdown === "not_found") {
    return c.json({ error: "Session not found" }, 404);
  }

  const session = await sessionService.getSession(client, sessionIdParam(c));
  const ticker = session?.ticker ?? "session";
  const filename = `${ticker.toLowerCase()}-tradingagents-export.md`;

  return new Response(markdown, {
    status: 200,
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
});
