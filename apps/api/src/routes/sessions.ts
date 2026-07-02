/**
 * apps/api/src/routes/sessions.ts
 *
 * Session CRUD, report retrieval, and SSE streaming endpoints.
 * All routes require a verified Clerk session and are scoped to the owner.
 */

import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import type { CreateSessionRequest } from "@tradingagents/api-types";
import { formatSseEvent } from "@tradingagents/utils";
import { getSupabaseAdmin } from "@tradingagents/supabase";
import { requireUserId, getRequestUserId } from "../middleware/user-context.js";
import { getRunStreamUrl } from "../services/agents-client.js";
import * as sessionService from "../services/session-service.js";

export const sessionRoutes = new Hono();

sessionRoutes.use("*", requireUserId());

sessionRoutes.get("/sessions", async (c) => {
  const userId = getRequestUserId(c);
  const limit = Number(c.req.query("limit") ?? "20");
  const offset = Number(c.req.query("offset") ?? "0");
  const client = getSupabaseAdmin(c);
  const result = await sessionService.listSessions(client, userId, limit, offset);
  return c.json(result);
});

sessionRoutes.post("/sessions", async (c) => {
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

sessionRoutes.get("/sessions/:id", async (c) => {
  const userId = getRequestUserId(c);
  const client = getSupabaseAdmin(c);
  const session = await sessionService.getSession(client, c.req.param("id"), userId);
  if (!session) {
    return c.json({ error: "Session not found" }, 404);
  }
  return c.json(session);
});

sessionRoutes.delete("/sessions/:id", async (c) => {
  const userId = getRequestUserId(c);
  const client = getSupabaseAdmin(c);
  const deleted = await sessionService.deleteSession(client, c.req.param("id"), userId);
  if (!deleted) {
    return c.json({ error: "Session not found" }, 404);
  }
  return c.body(null, 204);
});

sessionRoutes.get("/sessions/:id/report", async (c) => {
  const userId = getRequestUserId(c);
  const id = c.req.param("id");
  const client = getSupabaseAdmin(c);
  const report = await sessionService.getSessionReport(client, id, userId);

  if (report === "not_found") {
    return c.json({ error: "Session not found" }, 404);
  }
  if (report === "not_ready") {
    return c.json({ error: "Report not ready" }, 409);
  }

  return c.json(report);
});

sessionRoutes.get("/sessions/:id/stream", async (c) => {
  const userId = getRequestUserId(c);
  const id = c.req.param("id");
  const client = getSupabaseAdmin(c);
  const session = await sessionService.getSession(client, id, userId);

  if (!session) {
    return c.json({ error: "Session not found" }, 404);
  }

  if (!session.runId) {
    return c.json({ error: "Session has no associated run" }, 409);
  }

  return streamSSE(c, async (stream) => {
    const stored = await sessionService.getStoredEvents(client, id);
    for (const event of stored) {
      await stream.writeSSE({
        event: event.type,
        data: JSON.stringify(event.payload),
      });
    }

    if (session.status === "completed" || session.status === "error" || session.status === "cancelled") {
      return;
    }

    const response = await fetch(getRunStreamUrl(session.runId!));
    if (!response.ok || !response.body) {
      await stream.writeSSE({
        event: "run.error",
        data: JSON.stringify({ message: "Failed to connect to agents stream" }),
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

        await stream.writeSSE({ event: eventType, data: dataLine });

        try {
          const payload = JSON.parse(dataLine) as Record<string, unknown>;
          await sessionService.persistEvent(client, id, eventType, payload);

          if (eventType === "report.section") {
            const section =
              typeof payload.section === "string" ? payload.section : null;
            const content =
              typeof payload.content === "string" ? payload.content : null;
            if (section && content) {
              await sessionService.persistReportSection(client, id, section, content);
            }
          }

          if (eventType === "run.completed") {
            const report = await sessionService.getSessionReport(client, id, userId);
            if (report !== "not_found" && report !== "not_ready") {
              await sessionService.markSessionCompleted(client, id, {
                markdown: report.markdown,
                sections: report.sections,
                decision: report.decision,
              });
            }
          }

          if (eventType === "run.error") {
            const message =
              typeof payload.message === "string"
                ? payload.message
                : "Run failed";
            await sessionService.markSessionError(client, id, message);
          }
        } catch {
          await sessionService.persistEvent(client, id, eventType, { raw: dataLine });
        }
      }
    }

    if (buffer.trim()) {
      await stream.write(formatSseEvent("message", { raw: buffer }));
    }
  });
});
