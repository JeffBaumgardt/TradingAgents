/**
 * apps/api/src/services/session-service.ts
 *
 * Session lifecycle management: persistence, validation, and event storage.
 */

import { count, desc, eq } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import type {
  CreateSessionRequest,
  ProviderCredentials,
  Session,
  SessionListResponse,
  SessionReport,
  SessionStatus,
} from "@tradingagents/api-types";
import {
  normalizeTicker,
  validateAnalysisDate,
  validateAnalysts,
  validateResearchDepth,
  validateTicker,
} from "@tradingagents/utils";
import { db } from "../db/index.js";
import { events, sessions, type SessionRow } from "../db/schema.js";
import * as agentsClient from "./agents-client.js";
import { getUserCredentialsRaw } from "./credentials-service.js";

function rowToSession(row: SessionRow): Session {
  return {
    id: row.id,
    status: row.status as SessionStatus,
    ticker: row.ticker,
    analysisDate: row.analysisDate,
    config: row.config as CreateSessionRequest,
    runId: row.runId,
    error: row.error,
    decision: row.decision,
    createdAt: new Date(row.createdAt).toISOString(),
    updatedAt: new Date(row.updatedAt).toISOString(),
  };
}

function sectionsToMarkdown(sections: Record<string, string | null>): string {
  const parts: string[] = [];
  const analystBlocks: [string, string][] = [
    ["market_report", "Market Analysis"],
    ["sentiment_report", "Social Sentiment"],
    ["news_report", "News Analysis"],
    ["fundamentals_report", "Fundamentals Analysis"],
  ];

  if (analystBlocks.some(([key]) => sections[key])) {
    parts.push("## Analyst Team Reports");
    for (const [key, title] of analystBlocks) {
      const content = sections[key];
      if (content) {
        parts.push(`### ${title}\n${content}`);
      }
    }
  }

  if (sections.investment_plan) {
    parts.push("## Research Team Decision", sections.investment_plan);
  }
  if (sections.trader_investment_plan) {
    parts.push("## Trading Team Plan", sections.trader_investment_plan);
  }
  if (sections.final_trade_decision) {
    parts.push("## Portfolio Management Decision", sections.final_trade_decision);
  }

  return parts.join("\n\n");
}

export function validateCreateRequest(
  body: CreateSessionRequest,
  providerCredentials: ProviderCredentials,
): string | null {
  if (!validateTicker(body.ticker)) {
    return "Invalid ticker symbol";
  }
  if (!validateAnalysisDate(body.analysisDate)) {
    return "analysisDate must be YYYY-MM-DD";
  }
  if (!validateAnalysts(body.analysts)) {
    return "At least one valid analyst is required";
  }
  if (!validateResearchDepth(body.researchDepth)) {
    return "researchDepth must be 1, 3, or 5";
  }
  if (!body.llmProvider || !body.quickThinkLlm || !body.deepThinkLlm) {
    return "LLM provider and model selections are required";
  }
  if (Object.keys(providerCredentials).length === 0) {
    return "At least one provider credential is required";
  }
  const providerKey = body.llmProvider.toLowerCase();
  const creds = providerCredentials[providerKey];
  if (!creds) {
    return `No credentials provided for selected provider: ${body.llmProvider}`;
  }
  if (providerKey !== "ollama" && !creds.apiKey?.trim()) {
    return `API key required for provider: ${body.llmProvider}`;
  }
  if (providerKey === "ollama") {
    const enabled = creds.enabled?.toLowerCase();
    if (!enabled || !["true", "1", "yes", "on"].includes(enabled)) {
      return "Ollama must be enabled in credentials before selecting it";
    }
  }
  return null;
}

export async function createSession(
  body: CreateSessionRequest,
  userId: string,
): Promise<Session> {
  const storedCredentials = await getUserCredentialsRaw(userId);
  const validationError = validateCreateRequest(body, storedCredentials);
  if (validationError) {
    throw new Error(validationError);
  }

  const normalized: CreateSessionRequest = {
    ...body,
    ticker: normalizeTicker(body.ticker),
    providerCredentials: storedCredentials,
  };

  const { providerCredentials, ...persistedConfig } = normalized;

  const id = uuidv4();
  const now = new Date();

  await db.insert(sessions).values({
    id,
    ticker: normalized.ticker,
    analysisDate: normalized.analysisDate,
    status: "pending",
    config: persistedConfig,
    createdAt: now,
    updatedAt: now,
  });

  const { runId } = await agentsClient.startRun(id, normalized);

  await db
    .update(sessions)
    .set({ runId, status: "running", updatedAt: new Date() })
    .where(eq(sessions.id, id));

  const row = (
    await db.select().from(sessions).where(eq(sessions.id, id)).limit(1)
  )[0];
  if (!row) {
    throw new Error("Failed to create session");
  }
  return rowToSession(row);
}

export async function getSession(id: string): Promise<Session | null> {
  const row = (
    await db.select().from(sessions).where(eq(sessions.id, id)).limit(1)
  )[0];
  return row ? rowToSession(row) : null;
}

export async function listSessions(
  limit = 20,
  offset = 0,
): Promise<SessionListResponse> {
  const items = await db
    .select()
    .from(sessions)
    .orderBy(desc(sessions.analysisDate), desc(sessions.createdAt))
    .limit(limit)
    .offset(offset);

  const [totalRow] = await db.select({ value: count() }).from(sessions);

  return {
    items: items.map(rowToSession),
    total: totalRow?.value ?? 0,
    limit,
    offset,
  };
}

export async function cancelSession(id: string): Promise<Session | null> {
  const row = (
    await db.select().from(sessions).where(eq(sessions.id, id)).limit(1)
  )[0];
  if (!row) {
    return null;
  }

  if (row.runId && row.status === "running") {
    await agentsClient.cancelRun(row.runId);
  }

  await db
    .update(sessions)
    .set({ status: "cancelled", updatedAt: new Date() })
    .where(eq(sessions.id, id));

  return getSession(id);
}

export async function deleteSession(id: string): Promise<boolean> {
  const row = (
    await db.select().from(sessions).where(eq(sessions.id, id)).limit(1)
  )[0];
  if (!row) {
    return false;
  }

  if (row.runId && row.status === "running") {
    try {
      await agentsClient.cancelRun(row.runId);
    } catch {
      // Best-effort cancel before removing persisted data.
    }
  }

  await db.delete(events).where(eq(events.sessionId, id));
  await db.delete(sessions).where(eq(sessions.id, id));
  return true;
}

export async function persistEvent(
  sessionId: string,
  type: string,
  payload: Record<string, unknown>,
): Promise<void> {
  await db.insert(events).values({
    sessionId,
    type,
    payload,
    createdAt: new Date(),
  });
}

export async function persistReportSection(
  sessionId: string,
  section: string,
  content: string,
): Promise<void> {
  const row = (
    await db.select().from(sessions).where(eq(sessions.id, sessionId)).limit(1)
  )[0];
  if (!row) {
    return;
  }

  const sections = {
    ...((row.reportSections as Record<string, string | null> | null) ?? {}),
    [section]: content,
  };

  await db
    .update(sessions)
    .set({
      reportSections: sections,
      reportMarkdown: sectionsToMarkdown(sections),
      updatedAt: new Date(),
    })
    .where(eq(sessions.id, sessionId));
}

export async function markSessionCompleted(
  sessionId: string,
  report: {
    markdown: string;
    sections: Record<string, string | null>;
    decision: string | null;
  },
): Promise<void> {
  await db
    .update(sessions)
    .set({
      status: "completed",
      reportMarkdown: report.markdown,
      reportSections: report.sections,
      decision: report.decision,
      updatedAt: new Date(),
    })
    .where(eq(sessions.id, sessionId));
}

export async function markSessionError(
  sessionId: string,
  message: string,
): Promise<void> {
  await db
    .update(sessions)
    .set({ status: "error", error: message, updatedAt: new Date() })
    .where(eq(sessions.id, sessionId));
}

export async function getSessionReport(
  id: string,
): Promise<SessionReport | "not_found" | "not_ready"> {
  const row = (
    await db.select().from(sessions).where(eq(sessions.id, id)).limit(1)
  )[0];
  if (!row) {
    return "not_found";
  }

  if (row.status === "completed" && row.reportMarkdown) {
    return {
      sessionId: id,
      markdown: row.reportMarkdown,
      sections: (row.reportSections as Record<string, string | null>) ?? {},
      decision: row.decision,
    };
  }

  const storedSections = (row.reportSections as Record<string, string | null> | null) ?? {};
  if (
    row.status === "completed" &&
    Object.values(storedSections).some((value) => Boolean(value))
  ) {
    return {
      sessionId: id,
      markdown: sectionsToMarkdown(storedSections),
      sections: storedSections,
      decision: row.decision,
    };
  }

  if (row.runId && row.status === "running") {
    try {
      const report = await agentsClient.fetchRunReport(row.runId);
      await markSessionCompleted(id, report);
      return {
        sessionId: id,
        markdown: report.markdown,
        sections: report.sections,
        decision: report.decision,
      };
    } catch {
      return "not_ready";
    }
  }

  return "not_ready";
}

export async function getStoredEvents(sessionId: string) {
  return db
    .select()
    .from(events)
    .where(eq(events.sessionId, sessionId))
    .orderBy(events.id);
}
