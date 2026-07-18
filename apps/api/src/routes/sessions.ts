/**
 * apps/api/src/routes/sessions.ts
 *
 * Session CRUD, report retrieval, and SSE streaming endpoints.
 *
 * Share-by-link reads (GET session / report / trade-check) are public: the
 * session UUID is the capability. Mutations, event history, and live streams
 * still require a verified Clerk session and are scoped to the owner.
 */

import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import type { CreateSessionRequest } from "@tradingagents/api-types";
import { formatSseEvent } from "@tradingagents/utils";
import { getSupabaseAdmin } from "@tradingagents/supabase";
import { requireUserId, getRequestUserId } from "../middleware/user-context.js";
import { getRunStreamUrl, fetchRunStatus } from "../services/agents-client.js";
import * as sessionService from "../services/session-service.js";

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
): Promise<boolean> {
  await stream.writeSSE({ event: eventType, data: dataLine });

  try {
    const payload = JSON.parse(dataLine) as Record<string, unknown>;
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

  try {
    const session = await sessionService.createSession(client, body, userId);
    return c.json(session, 201);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid request";
    return c.json({ error: message }, 400);
  }
});

/** Public share-by-link: session UUID is the capability (no ownership check). */
sessionRoutes.get("/sessions/:id", async (c) => {
  const client = getSupabaseAdmin(c);
  const session = await sessionService.getSession(client, sessionIdParam(c));
  if (!session) {
    return c.json({ error: "Session not found" }, 404);
  }
  return c.json(session);
});

sessionRoutes.delete("/sessions/:id", requireUserId(), async (c) => {
  const userId = getRequestUserId(c);
  const client = getSupabaseAdmin(c);
  const deleted = await sessionService.deleteSession(client, sessionIdParam(c), userId);
  if (!deleted) {
    return c.json({ error: "Session not found" }, 404);
  }
  return c.body(null, 204);
});

/** Public share-by-link: final agent report for a completed run. */
sessionRoutes.get("/sessions/:id/report", async (c) => {
  const id = sessionIdParam(c);
  const client = getSupabaseAdmin(c);
  const report = await sessionService.getSessionReport(client, id);

  if (report === "not_found") {
    return c.json({ error: "Session not found" }, 404);
  }
  if (report === "not_ready") {
    return c.json({ error: "Report not ready" }, 409);
  }

  return c.json(report);
});

/** Public share-by-link: Trade Check chart payload. */
sessionRoutes.get("/sessions/:id/trade-check", async (c) => {
  const id = sessionIdParam(c);
  const client = getSupabaseAdmin(c);
  const tradeCheck = await sessionService.getSessionTradeCheck(client, id);

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
        );
        if (terminal) {
          sawTerminalEvent = true;
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
