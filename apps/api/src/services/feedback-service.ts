/**
 * apps/api/src/services/feedback-service.ts
 *
 * Validates feedback submissions and emails them via Resend.
 * MVP stores nothing in the database — email delivery only.
 *
 * Future: Resend attachments can carry MD report files when sessionId is set;
 * keep the email body free of report markdown so attachments stay optional.
 */

import { Resend } from "resend";
import type {
  FeedbackCategory,
  FeedbackRequest,
  FeedbackResponse,
  FeedbackSource,
  Session,
} from "@tradingagents/api-types";
import type { AppSupabaseClient } from "@tradingagents/supabase";
import { ensureUser } from "./user-service.js";
import { getSession } from "./session-service.js";

const MAX_MESSAGE_LENGTH = 4000;
const MAX_PAGE_URL_LENGTH = 2048;
const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;

/**
 * Soft in-process rate limit (MVP). This Map is per Node process only — it is
 * not shared across instances and resets on restart. Prefer a shared store
 * before treating the 5/hour cap as a hard guarantee.
 */
const submissionTimestampsByUser = new Map<string, number[]>();

const FEEDBACK_SOURCES = new Set<FeedbackSource>(["post_run", "footer"]);
const FEEDBACK_CATEGORIES = new Set<FeedbackCategory>([
  "bug",
  "idea",
  "praise",
  "other",
]);

export class FeedbackServiceError extends Error {
  status: 400 | 404 | 429 | 503;

  constructor(message: string, status: 400 | 404 | 429 | 503) {
    super(message);
    this.name = "FeedbackServiceError";
    this.status = status;
  }
}

export interface FeedbackEmailPayload {
  from: string;
  to: string;
  replyTo?: string;
  subject: string;
  text: string;
  html: string;
}

export type FeedbackEmailSender = (payload: FeedbackEmailPayload) => Promise<void>;

/** Test helper — clears the in-memory rate-limit window. */
export function resetFeedbackRateLimitForTests(): void {
  submissionTimestampsByUser.clear();
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function asOptionalString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function parseFeedbackRequest(body: unknown): FeedbackRequest {
  if (!body || typeof body !== "object") {
    throw new FeedbackServiceError("Invalid feedback payload", 400);
  }

  const record = body as Record<string, unknown>;
  const message = typeof record.message === "string" ? record.message.trim() : "";
  if (!message) {
    throw new FeedbackServiceError("Message is required", 400);
  }
  if (message.length > MAX_MESSAGE_LENGTH) {
    throw new FeedbackServiceError(
      `Message must be at most ${MAX_MESSAGE_LENGTH} characters`,
      400,
    );
  }

  const source = record.source;
  if (typeof source !== "string" || !FEEDBACK_SOURCES.has(source as FeedbackSource)) {
    throw new FeedbackServiceError("Source must be post_run or footer", 400);
  }

  let category: FeedbackCategory | undefined;
  if (record.category !== undefined && record.category !== null) {
    if (
      typeof record.category !== "string" ||
      !FEEDBACK_CATEGORIES.has(record.category as FeedbackCategory)
    ) {
      throw new FeedbackServiceError(
        "Category must be bug, idea, praise, or other",
        400,
      );
    }
    category = record.category as FeedbackCategory;
  }

  let rating: 1 | 2 | 3 | 4 | 5 | undefined;
  if (record.rating !== undefined && record.rating !== null) {
    if (
      typeof record.rating !== "number" ||
      !Number.isInteger(record.rating) ||
      record.rating < 1 ||
      record.rating > 5
    ) {
      throw new FeedbackServiceError("Rating must be an integer from 1 to 5", 400);
    }
    rating = record.rating as 1 | 2 | 3 | 4 | 5;
  }

  const sessionId = asOptionalString(record.sessionId);
  const pageUrlRaw = asOptionalString(record.pageUrl);
  if (pageUrlRaw && pageUrlRaw.length > MAX_PAGE_URL_LENGTH) {
    throw new FeedbackServiceError(
      `pageUrl must be at most ${MAX_PAGE_URL_LENGTH} characters`,
      400,
    );
  }
  if (pageUrlRaw && !/^https?:\/\//i.test(pageUrlRaw)) {
    throw new FeedbackServiceError("pageUrl must be an http(s) URL", 400);
  }
  const pageUrl = pageUrlRaw;

  return {
    message,
    source: source as FeedbackSource,
    ...(category ? { category } : {}),
    ...(rating ? { rating } : {}),
    ...(sessionId ? { sessionId } : {}),
    ...(pageUrl ? { pageUrl } : {}),
  };
}

/**
 * Soft rate limit: reserve a slot before send so concurrent requests cannot
 * all pass a check-then-record race. Failures still consume a slot (MVP tradeoff).
 */
function reserveRateLimitSlot(userId: string): void {
  const now = Date.now();
  const recent = (submissionTimestampsByUser.get(userId) ?? []).filter(
    (timestamp) => now - timestamp < RATE_LIMIT_WINDOW_MS,
  );

  if (recent.length >= RATE_LIMIT_MAX) {
    throw new FeedbackServiceError(
      "Too many feedback submissions. Please try again later.",
      429,
    );
  }

  recent.push(now);
  submissionTimestampsByUser.set(userId, recent);
}

function formatAnalysts(session: Session): string {
  const analysts = session.config.analysts;
  if (!Array.isArray(analysts) || analysts.length === 0) {
    return "(none)";
  }
  return analysts.join(", ");
}

export function buildFeedbackEmailContent(input: {
  userId: string;
  email: string | null;
  request: FeedbackRequest;
  session: Session | null;
  submittedAt?: string;
}): { subject: string; text: string; html: string } {
  const { userId, email, request, session } = input;
  const submittedAt = input.submittedAt ?? new Date().toISOString();
  const tickerLabel = session?.ticker ?? "General";
  const categoryLabel = request.category ?? "feedback";
  const subject = `[Feedback] ${tickerLabel} — ${categoryLabel}`;

  const lines = [
    "New feedback from TradingAgents",
    `From: ${email ?? "(no email on file)"} (userId: ${userId})`,
    `Source: ${request.source}`,
    `Category: ${request.category ?? "(none)"}`,
    `Rating: ${request.rating ?? "(none)"}`,
    `Page: ${request.pageUrl ?? "(none)"}`,
    `Submitted: ${submittedAt}`,
    "",
    "Message:",
    request.message,
  ];

  if (session) {
    lines.push(
      "",
      "--- Run context (if sessionId) ---",
      `Session: ${session.id}`,
      `Status: ${session.status}`,
      `Ticker: ${session.ticker}`,
      `Analysis date: ${session.analysisDate}`,
      `Decision: ${session.decision ?? "(none)"}`,
      `Error: ${session.error ?? "(none)"}`,
      `Run ID: ${session.runId ?? "(none)"}`,
      `Created: ${session.createdAt}`,
      `Updated: ${session.updatedAt}`,
      `Provider: ${session.config.llmProvider}`,
      `Models: quick=${session.config.quickThinkLlm} deep=${session.config.deepThinkLlm}`,
      `Research depth: ${session.config.researchDepth}`,
      `Analysts: ${formatAnalysts(session)}`,
      `Language: ${session.config.outputLanguage}`,
    );
  }

  const text = lines.join("\n");

  const htmlParts = [
    "<p><strong>New feedback from TradingAgents</strong></p>",
    `<p>From: ${escapeHtml(email ?? "(no email on file)")} (userId: ${escapeHtml(userId)})</p>`,
    `<p>Source: ${escapeHtml(request.source)}<br/>`,
    `Category: ${escapeHtml(request.category ?? "(none)")}<br/>`,
    `Rating: ${escapeHtml(String(request.rating ?? "(none)"))}<br/>`,
    `Page: ${escapeHtml(request.pageUrl ?? "(none)")}<br/>`,
    `Submitted: ${escapeHtml(submittedAt)}</p>`,
    "<p><strong>Message:</strong></p>",
    `<pre style="white-space:pre-wrap;font-family:inherit;">${escapeHtml(request.message)}</pre>`,
  ];

  if (session) {
    htmlParts.push(
      "<hr/>",
      "<p><strong>Run context</strong></p>",
      "<ul>",
      `<li>Session: ${escapeHtml(session.id)}</li>`,
      `<li>Status: ${escapeHtml(session.status)}</li>`,
      `<li>Ticker: ${escapeHtml(session.ticker)}</li>`,
      `<li>Analysis date: ${escapeHtml(session.analysisDate)}</li>`,
      `<li>Decision: ${escapeHtml(session.decision ?? "(none)")}</li>`,
      `<li>Error: ${escapeHtml(session.error ?? "(none)")}</li>`,
      `<li>Run ID: ${escapeHtml(session.runId ?? "(none)")}</li>`,
      `<li>Created: ${escapeHtml(session.createdAt)}</li>`,
      `<li>Updated: ${escapeHtml(session.updatedAt)}</li>`,
      `<li>Provider: ${escapeHtml(session.config.llmProvider)}</li>`,
      `<li>Models: quick=${escapeHtml(session.config.quickThinkLlm)} deep=${escapeHtml(session.config.deepThinkLlm)}</li>`,
      `<li>Research depth: ${escapeHtml(String(session.config.researchDepth))}</li>`,
      `<li>Analysts: ${escapeHtml(formatAnalysts(session))}</li>`,
      `<li>Language: ${escapeHtml(session.config.outputLanguage)}</li>`,
      "</ul>",
    );
  }

  return { subject, text, html: htmlParts.join("\n") };
}

async function defaultResendSender(payload: FeedbackEmailPayload): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    throw new FeedbackServiceError(
      "Feedback email is not configured (missing RESEND_API_KEY)",
      503,
    );
  }

  const resend = new Resend(apiKey);
  const result = await resend.emails.send({
    from: payload.from,
    to: payload.to,
    replyTo: payload.replyTo,
    subject: payload.subject,
    text: payload.text,
    html: payload.html,
  });

  if (result.error) {
    throw new Error(result.error.message);
  }
}

export async function sendFeedbackEmail(
  client: AppSupabaseClient,
  userId: string,
  rawBody: unknown,
  options?: { sendEmail?: FeedbackEmailSender },
): Promise<FeedbackResponse> {
  const request = parseFeedbackRequest(rawBody);

  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey && !options?.sendEmail) {
    throw new FeedbackServiceError(
      "Feedback email is not configured (missing RESEND_API_KEY)",
      503,
    );
  }

  const from = process.env.FEEDBACK_FROM_EMAIL?.trim();
  if (!from) {
    throw new FeedbackServiceError(
      "Feedback email is not configured (missing FEEDBACK_FROM_EMAIL)",
      503,
    );
  }

  const to =
    process.env.FEEDBACK_TO_EMAIL?.trim() || "jeff@bugfoot.net"; // product default per locked decision

  const user = await ensureUser(client, userId);

  let session: Session | null = null;
  if (request.sessionId) {
    session = await getSession(client, request.sessionId, userId);
    if (!session) {
      throw new FeedbackServiceError("Session not found", 404);
    }
  }

  reserveRateLimitSlot(userId);

  const { subject, text, html } = buildFeedbackEmailContent({
    userId,
    email: user.email,
    request,
    session,
  });

  const sendEmail = options?.sendEmail ?? defaultResendSender;
  await sendEmail({
    from,
    to,
    replyTo: user.email ?? undefined,
    subject,
    text,
    html,
  });

  return { ok: true };
}
