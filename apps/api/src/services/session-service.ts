/**
 * apps/api/src/services/session-service.ts
 *
 * Session lifecycle management: persistence, validation, and event storage.
 */

import { v4 as uuidv4 } from "uuid";
import type {
  CreateSessionRequest,
  ProviderCredentials,
  Session,
  SessionListResponse,
  SessionReport,
  SessionStatus,
  SessionTradeCheckResponse,
  TradeCheckReport,
} from "@tradingagents/api-types";
import {
  normalizeTicker,
  sanitizeUserContext,
  validateAnalysisDate,
  validateAnalysts,
  validateResearchDepth,
  validateTicker,
  validateUserContext,
} from "@tradingagents/utils";
import type { AppSupabaseClient, EventRow, SessionRow } from "@tradingagents/supabase";
import * as agentsClient from "./agents-client.js";
import { getUserCredentialsRaw } from "./credentials-service.js";

function rowToSession(row: SessionRow): Session {
  return {
    id: row.id,
    userId: row.user_id,
    status: row.status as SessionStatus,
    ticker: row.ticker,
    analysisDate: row.analysis_date,
    config: row.config,
    runId: row.run_id,
    error: row.error,
    decision: row.decision,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function isSessionOwnedByUser(row: SessionRow, userId: string): boolean {
  return row.user_id === userId;
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
  if (!creds.apiKey?.trim()) {
    return `API key required for provider: ${body.llmProvider}`;
  }
  const userContextError = validateUserContext(body.userContext);
  if (userContextError) {
    return userContextError;
  }
  return null;
}

export async function createSession(
  client: AppSupabaseClient,
  body: CreateSessionRequest,
  userId: string,
): Promise<Session> {
  const storedCredentials = await getUserCredentialsRaw(client, userId);
  const validationError = validateCreateRequest(body, storedCredentials);
  if (validationError) {
    throw new Error(validationError);
  }

  const normalized: CreateSessionRequest = {
    ...body,
    ticker: normalizeTicker(body.ticker),
    userContext: sanitizeUserContext(body.userContext),
    providerCredentials: storedCredentials,
  };

  const { providerCredentials: _providerCredentials, ...persistedConfig } = normalized;

  const id = uuidv4();
  const now = new Date().toISOString();

  const { error: insertError } = await client.from("sessions").insert({
    id,
    user_id: userId,
    ticker: normalized.ticker,
    analysis_date: normalized.analysisDate,
    status: "pending",
    config: persistedConfig,
    created_at: now,
    updated_at: now,
  });

  if (insertError) {
    throw new Error(insertError.message);
  }

  const { runId } = await agentsClient.startRun(id, normalized);

  const { error: updateError } = await client
    .from("sessions")
    .update({ run_id: runId, status: "running", updated_at: new Date().toISOString() })
    .eq("id", id);

  if (updateError) {
    throw new Error(updateError.message);
  }

  const session = await getSession(client, id, userId);
  if (!session) {
    throw new Error("Failed to create session");
  }
  return session;
}

export async function getSession(
  client: AppSupabaseClient,
  id: string,
  userId?: string,
): Promise<Session | null> {
  const { data, error } = await client
    .from("sessions")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    return null;
  }

  const row = data as SessionRow;
  if (userId && !isSessionOwnedByUser(row, userId)) {
    return null;
  }

  return rowToSession(row);
}

export async function listSessions(
  client: AppSupabaseClient,
  userId: string,
  limit = 20,
  offset = 0,
): Promise<SessionListResponse> {
  const { data: items, error, count } = await client
    .from("sessions")
    .select("*", { count: "exact" })
    .eq("user_id", userId)
    .order("analysis_date", { ascending: false })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    throw new Error(error.message);
  }

  return {
    items: (items ?? []).map((row) => rowToSession(row as SessionRow)),
    total: count ?? 0,
    limit,
    offset,
  };
}

export async function cancelSession(
  client: AppSupabaseClient,
  id: string,
  userId?: string,
): Promise<Session | null> {
  const { data: row, error } = await client
    .from("sessions")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }
  if (!row) {
    return null;
  }

  const sessionRow = row as SessionRow;
  if (userId && !isSessionOwnedByUser(sessionRow, userId)) {
    return null;
  }

  if (sessionRow.run_id && sessionRow.status === "running") {
    await agentsClient.cancelRun(sessionRow.run_id);
  }

  const { error: updateError } = await client
    .from("sessions")
    .update({ status: "cancelled", updated_at: new Date().toISOString() })
    .eq("id", id);

  if (updateError) {
    throw new Error(updateError.message);
  }

  return getSession(client, id, userId);
}

export async function deleteSession(
  client: AppSupabaseClient,
  id: string,
  userId?: string,
): Promise<boolean> {
  const { data: row, error } = await client
    .from("sessions")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }
  if (!row) {
    return false;
  }

  const sessionRow = row as SessionRow;
  if (userId && !isSessionOwnedByUser(sessionRow, userId)) {
    return false;
  }

  if (sessionRow.run_id && sessionRow.status === "running") {
    try {
      await agentsClient.cancelRun(sessionRow.run_id);
    } catch {
      // Best-effort cancel before removing persisted data.
    }
  }

  const { error: deleteEventsError } = await client
    .from("events")
    .delete()
    .eq("session_id", id);

  if (deleteEventsError) {
    throw new Error(deleteEventsError.message);
  }

  const { error: deleteSessionError } = await client
    .from("sessions")
    .delete()
    .eq("id", id);

  if (deleteSessionError) {
    throw new Error(deleteSessionError.message);
  }

  return true;
}

export async function persistEvent(
  client: AppSupabaseClient,
  sessionId: string,
  type: string,
  payload: Record<string, unknown>,
): Promise<void> {
  const { error } = await client.from("events").insert({
    session_id: sessionId,
    type,
    payload,
    created_at: new Date().toISOString(),
  });

  if (error) {
    throw new Error(error.message);
  }
}

export async function persistReportSection(
  client: AppSupabaseClient,
  sessionId: string,
  section: string,
  content: string,
): Promise<void> {
  const { data: row, error } = await client
    .from("sessions")
    .select("*")
    .eq("id", sessionId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }
  if (!row) {
    return;
  }

  const sessionRow = row as SessionRow;
  const sections = {
    ...(sessionRow.report_sections ?? {}),
    [section]: content,
  };

  const { error: updateError } = await client
    .from("sessions")
    .update({
      report_sections: sections,
      report_markdown: sectionsToMarkdown(sections),
      updated_at: new Date().toISOString(),
    })
    .eq("id", sessionId);

  if (updateError) {
    throw new Error(updateError.message);
  }
}

export async function markSessionCompleted(
  client: AppSupabaseClient,
  sessionId: string,
  report: {
    markdown: string;
    sections: Record<string, string | null>;
    decision: string | null;
    tradeCheck?: Record<string, unknown> | null;
  },
): Promise<void> {
  const updatePayload: Record<string, unknown> = {
    status: "completed",
    report_markdown: report.markdown,
    report_sections: report.sections,
    decision: report.decision,
    updated_at: new Date().toISOString(),
  };
  if (report.tradeCheck) {
    updatePayload.trade_check_json = report.tradeCheck;
  }

  const { error } = await client
    .from("sessions")
    .update(updatePayload)
    .eq("id", sessionId);

  if (error) {
    throw new Error(error.message);
  }
}

export async function markSessionError(
  client: AppSupabaseClient,
  sessionId: string,
  message: string,
): Promise<void> {
  const { error } = await client
    .from("sessions")
    .update({
      status: "error",
      error: message,
      updated_at: new Date().toISOString(),
    })
    .eq("id", sessionId);

  if (error) {
    throw new Error(error.message);
  }
}

export async function getSessionReport(
  client: AppSupabaseClient,
  id: string,
  userId?: string,
): Promise<SessionReport | "not_found" | "not_ready"> {
  const { data: row, error } = await client
    .from("sessions")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }
  if (!row) {
    return "not_found";
  }

  const sessionRow = row as SessionRow;
  if (userId && !isSessionOwnedByUser(sessionRow, userId)) {
    return "not_found";
  }

  if (sessionRow.status === "completed" && sessionRow.report_markdown) {
    let tradeCheck = rowTradeCheck(sessionRow);
    if (!tradeCheck) {
      tradeCheck = await backfillTradeCheckForSession(client, sessionRow);
    }
    return {
      sessionId: id,
      markdown: sessionRow.report_markdown,
      sections: sessionRow.report_sections ?? {},
      decision: sessionRow.decision,
      tradeCheck,
    };
  }

  const storedSections = sessionRow.report_sections ?? {};
  if (
    sessionRow.status === "completed" &&
    Object.values(storedSections).some((value) => Boolean(value))
  ) {
    let tradeCheck = rowTradeCheck(sessionRow);
    if (!tradeCheck) {
      tradeCheck = await backfillTradeCheckForSession(client, sessionRow);
    }
    return {
      sessionId: id,
      markdown: sectionsToMarkdown(storedSections),
      sections: storedSections,
      decision: sessionRow.decision,
      tradeCheck,
    };
  }

  if (sessionRow.run_id && sessionRow.status === "running") {
    try {
      const report = await agentsClient.fetchRunReport(sessionRow.run_id);
      await markSessionCompleted(client, id, {
        markdown: report.markdown,
        sections: report.sections,
        decision: report.decision,
        tradeCheck: report.tradeCheck as Record<string, unknown> | null | undefined,
      });
      return {
        sessionId: id,
        markdown: report.markdown,
        sections: report.sections,
        decision: report.decision,
        tradeCheck: (report.tradeCheck as TradeCheckReport | null | undefined) ?? null,
      };
    } catch {
      return "not_ready";
    }
  }

  return "not_ready";
}

function rowTradeCheck(row: SessionRow): TradeCheckReport | null {
  if (!row.trade_check_json || typeof row.trade_check_json !== "object") {
    return null;
  }
  return row.trade_check_json as unknown as TradeCheckReport;
}

async function backfillTradeCheckForSession(
  client: AppSupabaseClient,
  sessionRow: SessionRow,
): Promise<TradeCheckReport | null> {
  const existing = rowTradeCheck(sessionRow);
  if (existing) {
    return existing;
  }

  if (sessionRow.run_id) {
    try {
      const report = await agentsClient.fetchRunReport(sessionRow.run_id);
      if (report.tradeCheck && typeof report.tradeCheck === "object") {
        const tradeCheck = report.tradeCheck as unknown as TradeCheckReport;
        await persistTradeCheckIfMissing(client, sessionRow.id, report.tradeCheck);
        return tradeCheck;
      }
    } catch (error) {
      console.error(
        `[session-service] Trade Check backfill from run ${sessionRow.run_id} failed:`,
        error,
      );
    }
  }

  const sections = sessionRow.report_sections ?? {};
  if (!Object.values(sections).some((value) => Boolean(value))) {
    return null;
  }

  const config = sessionRow.config;
  try {
    const rebuilt = await agentsClient.rebuildTradeCheck({
      sessionId: sessionRow.id,
      ticker: sessionRow.ticker,
      analysisDate: sessionRow.analysis_date,
      userContext: config.userContext,
      sections,
    });
    await persistTradeCheckIfMissing(client, sessionRow.id, rebuilt.tradeCheck);
    return rebuilt.tradeCheck as unknown as TradeCheckReport;
  } catch (error) {
    console.error(
      `[session-service] Trade Check rebuild for session ${sessionRow.id} failed:`,
      error,
    );
    return null;
  }
}

async function persistTradeCheckIfMissing(
  client: AppSupabaseClient,
  sessionId: string,
  tradeCheck: Record<string, unknown>,
): Promise<void> {
  const { data: row, error } = await client
    .from("sessions")
    .select("trade_check_json")
    .eq("id", sessionId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (row?.trade_check_json && typeof row.trade_check_json === "object") {
    return;
  }

  await persistTradeCheck(client, sessionId, tradeCheck);
}

export async function persistTradeCheck(
  client: AppSupabaseClient,
  sessionId: string,
  tradeCheck: Record<string, unknown>,
): Promise<void> {
  const { error } = await client
    .from("sessions")
    .update({
      trade_check_json: tradeCheck,
      updated_at: new Date().toISOString(),
    })
    .eq("id", sessionId);

  if (error) {
    throw new Error(error.message);
  }
}

export async function getSessionTradeCheck(
  client: AppSupabaseClient,
  id: string,
  userId?: string,
): Promise<SessionTradeCheckResponse | "not_found" | "not_ready" | "unavailable"> {
  const { data: row, error } = await client
    .from("sessions")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }
  if (!row) {
    return "not_found";
  }

  const sessionRow = row as SessionRow;
  if (userId && !isSessionOwnedByUser(sessionRow, userId)) {
    return "not_found";
  }

  const stored = rowTradeCheck(sessionRow);
  if (sessionRow.status === "completed" && stored) {
    return { sessionId: id, tradeCheck: stored };
  }

  if (sessionRow.status === "completed" && !stored) {
    const backfilled = await backfillTradeCheckForSession(client, sessionRow);
    if (backfilled) {
      return { sessionId: id, tradeCheck: backfilled };
    }
    return "unavailable";
  }

  if (sessionRow.run_id && sessionRow.status === "running") {
    try {
      const report = await agentsClient.fetchRunReport(sessionRow.run_id);
      if (report.tradeCheck) {
        await persistTradeCheck(client, id, report.tradeCheck as Record<string, unknown>);
        return {
          sessionId: id,
          tradeCheck: report.tradeCheck as unknown as TradeCheckReport,
        };
      }
    } catch {
      return "not_ready";
    }
  }

  return "not_ready";
}

export async function getStoredEvents(
  client: AppSupabaseClient,
  sessionId: string,
): Promise<EventRow[]> {
  const { data, error } = await client
    .from("events")
    .select("*")
    .eq("session_id", sessionId)
    .order("id", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as EventRow[];
}
