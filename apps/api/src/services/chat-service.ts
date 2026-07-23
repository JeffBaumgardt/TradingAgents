/**
 * apps/api/src/services/chat-service.ts
 *
 * Portfolio Manager follow-up chat: persistence, gates, turn start, export.
 */

import { randomUUID } from "node:crypto";
import type {
  ChatMessagePart,
  ChatMessageRole,
  ChatMessageStatus,
  CreateSessionRequest,
  PostChatMessageResponse,
  SessionChatMessage,
  SessionChatResponse,
} from "@tradingagents/api-types";
import { getHostedModelCostEntry, resolveThinkLlm } from "@tradingagents/api-types";
import type { AppSupabaseClient, SessionChatMessageRow, SessionRow } from "@tradingagents/supabase";
import { canonicalBackendUrlForProvider } from "../lib/provider-backend-urls.js";
import * as agentsClient from "./agents-client.js";
import { getBillingAccount, userHasActiveSubscription } from "./billing-account-service.js";
import {
  assertHostedCreditsForFollowUp,
  initSessionUsageCursor,
} from "./credit-service.js";
import { getUserCredentialsRaw } from "./credentials-service.js";
import { resolveRunProviderCredentials } from "./platform-keys-service.js";
import { startBackgroundChatMetering } from "./run-metering-service.js";
import { SessionServiceError } from "./session-service.js";

const MAX_USER_MESSAGE_CHARS = 12_000;
const MAX_PRIOR_MESSAGES = 40;
const MAX_PART_CONTENT = 50_000;

function isSoftDeleted(row: SessionRow): boolean {
  return row.status === "deleted" || row.deleted_on != null;
}

function asParts(raw: unknown): ChatMessagePart[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw.filter((part): part is ChatMessagePart => {
    return Boolean(part && typeof part === "object" && typeof (part as ChatMessagePart).type === "string");
  });
}

function rowToMessage(row: SessionChatMessageRow): SessionChatMessage {
  return {
    id: row.id,
    sessionId: row.session_id,
    role: row.role as ChatMessageRole,
    status: row.status as ChatMessageStatus,
    contentMarkdown: row.content_markdown ?? "",
    parts: asParts(row.parts),
    decisionExcerpt: row.decision_excerpt,
    tokensIn: Number(row.tokens_in ?? 0),
    tokensOut: Number(row.tokens_out ?? 0),
    creditsCharged: Number(row.credits_charged ?? 0),
    turnId: row.turn_id,
    error: row.error,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function truncateParts(parts: ChatMessagePart[]): ChatMessagePart[] {
  return parts.map((part) => {
    if (typeof part.content === "string" && part.content.length > MAX_PART_CONTENT) {
      return { ...part, content: `${part.content.slice(0, MAX_PART_CONTENT)}…` };
    }
    return part;
  });
}

export async function listChatMessages(
  client: AppSupabaseClient,
  sessionId: string,
  options: {
    requesterId?: string | null;
  } = {},
): Promise<SessionChatResponse | "not_found"> {
  const { data: session, error } = await client
    .from("sessions")
    .select("*")
    .eq("id", sessionId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }
  if (!session || isSoftDeleted(session as SessionRow)) {
    return "not_found";
  }

  const row = session as SessionRow;
  const isOwner = Boolean(options.requesterId && row.user_id === options.requesterId);

  const { data: messages, error: msgError } = await client
    .from("session_chat_messages")
    .select("*")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true });

  if (msgError) {
    throw new Error(msgError.message);
  }

  let canChat = false;
  let chatBlockedReason: SessionChatResponse["chatBlockedReason"] = "not_owner";

  if (isOwner) {
    if (row.status !== "completed") {
      chatBlockedReason = "session_not_completed";
    } else {
      const account = await getBillingAccount(client, options.requesterId!);
      if (!userHasActiveSubscription(account.subscription)) {
        chatBlockedReason = "subscription_required";
      } else if (
        account.subscription.planId === "hosted" &&
        account.usage?.blockedLowBalance
      ) {
        chatBlockedReason = "credits_blocked";
      } else {
        canChat = true;
        chatBlockedReason = null;
      }
    }
  }

  const mapped = (messages as SessionChatMessageRow[] | null)?.map(rowToMessage) ?? [];
  const visible = isOwner
    ? mapped
    : mapped.map((message) => ({
        ...message,
        error: null,
        tokensIn: 0,
        tokensOut: 0,
        creditsCharged: 0,
        turnId: null,
      }));

  return {
    messages: visible,
    canChat,
    chatBlockedReason,
  };
}

export async function postChatMessage(
  client: AppSupabaseClient,
  sessionId: string,
  userId: string,
  content: string,
): Promise<PostChatMessageResponse> {
  const trimmed = content.trim();
  if (!trimmed) {
    throw new SessionServiceError("Message cannot be empty.", 400, "empty_message");
  }
  if (trimmed.length > MAX_USER_MESSAGE_CHARS) {
    throw new SessionServiceError(
      `Message is too long (max ${MAX_USER_MESSAGE_CHARS.toLocaleString()} characters).`,
      400,
      "message_too_long",
    );
  }

  const { data: session, error } = await client
    .from("sessions")
    .select("*")
    .eq("id", sessionId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }
  if (!session || isSoftDeleted(session as SessionRow)) {
    throw new SessionServiceError("Session not found", 404, "not_found");
  }

  const row = session as SessionRow;
  if (row.user_id !== userId) {
    throw new SessionServiceError("Session not found", 404, "not_found");
  }
  if (row.status !== "completed") {
    throw new SessionServiceError(
      "Follow-up chat is only available after the analysis completes.",
      409,
      "session_not_completed",
    );
  }

  const account = await getBillingAccount(client, userId);
  if (!userHasActiveSubscription(account.subscription)) {
    throw new SessionServiceError(
      "An active subscription is required to chat with the Portfolio Manager.",
      402,
      "subscription_required",
    );
  }

  const { data: inflight } = await client
    .from("session_chat_messages")
    .select("id")
    .eq("session_id", sessionId)
    .eq("role", "assistant")
    .in("status", ["pending", "streaming"])
    .limit(1);

  if (inflight && inflight.length > 0) {
    throw new SessionServiceError(
      "A chat reply is already in progress. Wait for it to finish.",
      409,
      "chat_in_progress",
    );
  }

  const config = row.config as CreateSessionRequest;
  const storedCredentials = await getUserCredentialsRaw(client, userId);
  const isHostedPlan = account.subscription.planId === "hosted";
  const resolved = await resolveRunProviderCredentials(client, storedCredentials, {
    isHostedPlan,
    hostedProviderIds: account.hostedProviderIds,
    selectedProviderId: config.llmProvider,
  });

  const providerKey = config.llmProvider.toLowerCase();
  const hasUserKey = Boolean(storedCredentials[providerKey]?.apiKey?.trim());
  if (!hasUserKey && !resolved.usedPlatformKey) {
    throw new SessionServiceError(
      "Hosted inference is not configured for this provider yet. Pick another provider or add your own API key.",
      503,
      "platform_key_unavailable",
    );
  }

  const thinkLlm = resolveThinkLlm(config);
  if (resolved.usedPlatformKey) {
    const hostedModel = getHostedModelCostEntry(config.llmProvider, thinkLlm);
    if (!hostedModel) {
      throw new SessionServiceError(
        `Model "${thinkLlm}" is not available on the hosted plan for ${config.llmProvider}.`,
        400,
        "hosted_model_not_allowed",
      );
    }
  }

  if (isHostedPlan) {
    if (!account.subscription.currentPeriodStart || !account.subscription.currentPeriodEnd) {
      throw new SessionServiceError(
        "Your hosted subscription is missing billing period dates.",
        402,
        "credits_period_missing",
      );
    }
    const gate = await assertHostedCreditsForFollowUp(
      client,
      userId,
      {
        plan_id: "hosted",
        current_period_start: account.subscription.currentPeriodStart,
        current_period_end: account.subscription.currentPeriodEnd,
      },
      {
        llmProvider: config.llmProvider,
        thinkLlm,
        costSource: resolved.costSource,
      },
    );
    if (!gate.allowed) {
      throw new SessionServiceError(
        gate.message ?? "Insufficient compute credits for this chat turn.",
        402,
        gate.code ?? "credits_insufficient",
      );
    }
  }

  const prior = await listChatMessages(client, sessionId, { requesterId: userId });
  if (prior === "not_found") {
    throw new SessionServiceError("Session not found", 404, "not_found");
  }

  const priorForAgent = prior.messages
    .filter((message) => message.status === "completed" || message.role === "user")
    .slice(-MAX_PRIOR_MESSAGES)
    .map((message) => ({
      role: message.role,
      content: message.contentMarkdown,
    }));

  const now = new Date().toISOString();
  const userMessageId = randomUUID();
  const assistantMessageId = randomUUID();

  const userInsert = {
    id: userMessageId,
    session_id: sessionId,
    user_id: userId,
    role: "user",
    status: "completed",
    content_markdown: trimmed,
    parts: [{ type: "text", content: trimmed }],
    decision_excerpt: null,
    tokens_in: 0,
    tokens_out: 0,
    credits_charged: 0,
    turn_id: null,
    error: null,
    created_at: now,
    updated_at: now,
  };

  const assistantInsert = {
    id: assistantMessageId,
    session_id: sessionId,
    user_id: userId,
    role: "assistant",
    status: "streaming",
    content_markdown: "",
    parts: [] as ChatMessagePart[],
    decision_excerpt: null,
    tokens_in: 0,
    tokens_out: 0,
    credits_charged: 0,
    turn_id: null as string | null,
    error: null,
    created_at: now,
    updated_at: now,
  };

  const { error: userErr } = await client.from("session_chat_messages").insert(userInsert);
  if (userErr) {
    throw new Error(userErr.message);
  }
  const { error: asstErr } = await client.from("session_chat_messages").insert(assistantInsert);
  if (asstErr) {
    await client.from("session_chat_messages").delete().eq("id", userMessageId);
    throw new Error(asstErr.message);
  }

  await initSessionUsageCursor(client, {
    sessionId,
    userId,
    providerId: config.llmProvider,
    quickModelId: thinkLlm,
    deepModelId: thinkLlm,
    costSource: resolved.costSource,
    // Analysis cursors are deleted on run completion. Re-init for this turn with
    // watermarks at 0 so agents StatsCallbackHandler (also starting at 0) meters
    // only follow-up tokens — never replaying the completed analysis totals.
    usageKind: "follow_up",
  });

  const backendUrl = resolved.usedPlatformKey
    ? canonicalBackendUrlForProvider(config.llmProvider)
    : (config.backendUrl ?? null);

  let turnId: string;
  try {
    ({ turnId } = await agentsClient.startChatTurn({
      sessionId,
      assistantMessageId,
      userMessage: trimmed,
      ticker: row.ticker,
      analysisDate: row.analysis_date,
      userContext: config.userContext ?? null,
      decision: row.decision,
      reportSections: (row.report_sections ?? {}) as Record<string, string | null>,
      tradeCheck: (row.trade_check_json ?? null) as Record<string, unknown> | null,
      priorMessages: priorForAgent,
      llmProvider: config.llmProvider,
      backendUrl,
      thinkLlm,
      googleThinkingLevel: config.googleThinkingLevel ?? null,
      openaiReasoningEffort: config.openaiReasoningEffort ?? null,
      anthropicEffort: config.anthropicEffort ?? null,
      providerCredentials: resolved.credentials,
    }));
  } catch (error) {
    await client
      .from("session_chat_messages")
      .update({
        status: "error",
        error: error instanceof Error ? error.message : "Failed to start chat turn",
        updated_at: new Date().toISOString(),
      })
      .eq("id", assistantMessageId);
    await client.from("session_usage_cursors").delete().eq("session_id", sessionId);
    throw error;
  }

  await client
    .from("session_chat_messages")
    .update({ turn_id: turnId, updated_at: new Date().toISOString() })
    .eq("id", assistantMessageId);

  const subscription =
    account.subscription.planId &&
    account.subscription.currentPeriodStart &&
    account.subscription.currentPeriodEnd
      ? {
          plan_id: account.subscription.planId,
          current_period_start: account.subscription.currentPeriodStart,
          current_period_end: account.subscription.currentPeriodEnd,
        }
      : null;

  startBackgroundChatMetering({
    client,
    sessionId,
    turnId,
    assistantMessageId,
    userId,
    subscription,
    costSource: resolved.costSource,
    onTerminal: async ({ type, payload }) => {
      if (type === "chat.completed") {
        const parts = truncateParts(asParts(payload.parts));
        const contentMarkdown =
          typeof payload.contentMarkdown === "string" ? payload.contentMarkdown : "";
        const decisionExcerpt =
          typeof payload.decisionExcerpt === "string" ? payload.decisionExcerpt : null;
        const tokensIn = typeof payload.tokensIn === "number" ? payload.tokensIn : 0;
        const tokensOut = typeof payload.tokensOut === "number" ? payload.tokensOut : 0;

        const { data: cursor } = await client
          .from("session_usage_cursors")
          .select("credits_charged")
          .eq("session_id", sessionId)
          .maybeSingle();

        await client
          .from("session_chat_messages")
          .update({
            status: "completed",
            content_markdown: contentMarkdown,
            parts,
            decision_excerpt: decisionExcerpt,
            tokens_in: tokensIn,
            tokens_out: tokensOut,
            credits_charged: Number(cursor?.credits_charged ?? 0),
            error: null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", assistantMessageId)
          .eq("session_id", sessionId);
        return;
      }

      const message =
        typeof payload.message === "string" ? payload.message : "Chat turn failed";
      await client
        .from("session_chat_messages")
        .update({
          status: "error",
          error: message,
          updated_at: new Date().toISOString(),
        })
        .eq("id", assistantMessageId)
        .eq("session_id", sessionId);
    },
  });

  return {
    userMessage: rowToMessage(userInsert as SessionChatMessageRow),
    assistantMessage: rowToMessage({
      ...assistantInsert,
      turn_id: turnId,
    } as SessionChatMessageRow),
    turnId,
  };
}

export async function getOwnedChatTurn(
  client: AppSupabaseClient,
  input: {
    sessionId: string;
    userId: string;
    turnId: string;
  },
): Promise<{ id: string; sessionId: string; turnId: string } | null> {
  const { data, error } = await client
    .from("session_chat_messages")
    .select("id, session_id, turn_id")
    .eq("session_id", input.sessionId)
    .eq("user_id", input.userId)
    .eq("turn_id", input.turnId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }
  if (!data) {
    return null;
  }
  const row = data as { id: string; session_id: string; turn_id: string };
  return {
    id: row.id,
    sessionId: row.session_id,
    turnId: row.turn_id,
  };
}

export async function finalizeAssistantFromStream(
  client: AppSupabaseClient,
  assistantMessageId: string,
  sessionId: string,
  payload: Record<string, unknown>,
  status: "completed" | "error",
): Promise<void> {
  if (status === "error") {
    const message =
      typeof payload.message === "string" ? payload.message : "Chat turn failed";
    await client
      .from("session_chat_messages")
      .update({
        status: "error",
        error: message,
        updated_at: new Date().toISOString(),
      })
      .eq("id", assistantMessageId)
      .eq("session_id", sessionId);
    return;
  }

  const parts = truncateParts(asParts(payload.parts));
  const contentMarkdown =
    typeof payload.contentMarkdown === "string" ? payload.contentMarkdown : "";
  const decisionExcerpt =
    typeof payload.decisionExcerpt === "string" ? payload.decisionExcerpt : null;
  const tokensIn = typeof payload.tokensIn === "number" ? payload.tokensIn : 0;
  const tokensOut = typeof payload.tokensOut === "number" ? payload.tokensOut : 0;

  const { data: cursor } = await client
    .from("session_usage_cursors")
    .select("credits_charged")
    .eq("session_id", sessionId)
    .maybeSingle();

  await client
    .from("session_chat_messages")
    .update({
      status: "completed",
      content_markdown: contentMarkdown,
      parts,
      decision_excerpt: decisionExcerpt,
      tokens_in: tokensIn,
      tokens_out: tokensOut,
      credits_charged: Number(cursor?.credits_charged ?? 0),
      error: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", assistantMessageId)
    .eq("session_id", sessionId);
}

export async function buildSessionExportMarkdown(
  client: AppSupabaseClient,
  sessionId: string,
): Promise<string | "not_found"> {
  const { data: session, error } = await client
    .from("sessions")
    .select("*")
    .eq("id", sessionId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }
  if (!session || isSoftDeleted(session as SessionRow)) {
    return "not_found";
  }

  const row = session as SessionRow;
  const chat = await listChatMessages(client, sessionId, { requesterId: null });
  if (chat === "not_found") {
    return "not_found";
  }

  const config = row.config as CreateSessionRequest;
  const sections = (row.report_sections ?? {}) as Record<string, string | null>;
  const lines: string[] = [
    `# TradingAgents export — ${row.ticker}`,
    "",
    `Analysis date: ${row.analysis_date}`,
    `Status: ${row.status}`,
    `Decision: ${row.decision ?? "(none)"}`,
    `Model: ${config.llmProvider} / ${resolveThinkLlm(config)}`,
    `Research depth: ${config.researchDepth}`,
    `Analysts: ${(config.analysts ?? []).join(", ")}`,
    "",
    "## Original thesis / user context",
    "",
    config.userContext?.trim() || "(none)",
    "",
  ];

  const sectionTitles: Array<[string, string]> = [
    ["market_report", "Market Analysis"],
    ["sentiment_report", "Social Sentiment"],
    ["news_report", "News Analysis"],
    ["fundamentals_report", "Fundamentals Analysis"],
    ["investment_plan", "Research Team Decision"],
    ["trader_investment_plan", "Trading Team Plan"],
    ["final_trade_decision", "Portfolio Management Decision"],
  ];

  lines.push("## Research reports", "");
  for (const [key, title] of sectionTitles) {
    const content = sections[key];
    if (!content?.trim()) {
      continue;
    }
    lines.push(`### ${title}`, "", content.trim(), "");
  }

  if (row.trade_check_json) {
    lines.push(
      "## Trade Check snapshot",
      "",
      "```json",
      JSON.stringify(row.trade_check_json, null, 2),
      "```",
      "",
    );
  }

  lines.push("## Follow-up chat with Portfolio Manager", "");
  if (chat.messages.length === 0) {
    lines.push("(no follow-up messages)", "");
  } else {
    for (const message of chat.messages) {
      const label = message.role === "user" ? "User" : "Portfolio Manager";
      lines.push(`### ${label}`, "", message.contentMarkdown || "(empty)", "");
      if (message.decisionExcerpt) {
        lines.push(`Revised decision: ${message.decisionExcerpt}`, "");
      }
    }
  }

  lines.push(
    "---",
    "",
    "You can paste this export into another LLM as context to continue the discussion outside TradingAgents.",
    "",
  );

  return lines.join("\n");
}
