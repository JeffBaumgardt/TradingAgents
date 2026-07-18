/**
 * @file apps/web/src/lib/api-client.ts
 * HTTP and SSE client for the TradingAgents backend API.
 */

import type {
  ConfigOptions,
  CreateSessionRequest,
  CredentialsSchemaResponse,
  FeedbackRequest,
  FeedbackResponse,
  ModelMode,
  ProviderCredentials,
  ProviderModelsResponse,
  ResolvedConfigResponse,
  Session,
  SessionEventsResponse,
  SessionListResponse,
  SessionReport,
  SessionTradeCheckResponse,
  SseEventMap,
  SseEventType,
  StoredCredentialsResponse,
  UpdateUserRequest,
  User,
} from "@tradingagents/api-types";
import { SESSION_STREAM_ROTATE_MS } from "@tradingagents/api-types";
import { buildAuthHeaders } from "@/lib/auth-headers";

function resolveApiBase(): string {
  const raw = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (!raw) {
    return "http://localhost:4000";
  }

  const withoutTrailingSlash = raw.replace(/\/$/, "");
  if (/^https?:\/\//i.test(withoutTrailingSlash)) {
    return withoutTrailingSlash;
  }

  return `https://${withoutTrailingSlash}`;
}

const API_BASE = resolveApiBase();

export class ApiClientError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiClientError";
    this.status = status;
  }
}

async function buildUserHeaders(): Promise<HeadersInit> {
  return buildAuthHeaders();
}

/** Ensure the API has a user row and sync Clerk profile fields. */
export async function syncCurrentUser(
  _userId: string,
  profile: UpdateUserRequest,
): Promise<User> {
  const authHeaders = await buildAuthHeaders();

  await fetch(`${API_BASE}/users/me`, {
    headers: authHeaders,
    cache: "no-store",
  }).then((response) => parseJson<User>(response));

  const updateResponse = await fetch(`${API_BASE}/users/me`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders,
    },
    body: JSON.stringify(profile),
    cache: "no-store",
  });
  return parseJson<User>(updateResponse);
}

async function parseJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let message = response.statusText;
    try {
      const body = (await response.json()) as { error?: string; message?: string };
      message = body.error ?? body.message ?? message;
    } catch {
      // ignore parse errors
    }
    throw new ApiClientError(message, response.status);
  }
  return (await response.json()) as T;
}

/** Fetch credential field definitions for the setup screen. */
export async function fetchCredentialsSchema(): Promise<CredentialsSchemaResponse> {
  const response = await fetch(`${API_BASE}/config/credentials/schema`, {
    cache: "no-store",
  });
  return parseJson<CredentialsSchemaResponse>(response);
}

/** Load stored credentials (secret fields are masked). */
export async function fetchUserCredentials(): Promise<ProviderCredentials> {
  const response = await fetch(`${API_BASE}/credentials`, {
    headers: await buildUserHeaders(),
    cache: "no-store",
  });
  const body = await parseJson<StoredCredentialsResponse>(response);
  return body.providerCredentials;
}

/** Persist credentials server-side; response values are always masked. */
export async function saveUserCredentials(
  providerCredentials: ProviderCredentials,
): Promise<ProviderCredentials> {
  const response = await fetch(`${API_BASE}/credentials`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      ...(await buildUserHeaders()),
    },
    body: JSON.stringify({ providerCredentials }),
    cache: "no-store",
  });
  const body = await parseJson<StoredCredentialsResponse>(response);
  return body.providerCredentials;
}

/** Resolve config options filtered to providers the user has credentials for. */
export async function resolveConfig(): Promise<ResolvedConfigResponse> {
  const response = await fetch(`${API_BASE}/config/resolve`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(await buildUserHeaders()),
    },
    body: JSON.stringify({}),
    cache: "no-store",
  });
  return parseJson<ResolvedConfigResponse>(response);
}

/** Fetch wizard dropdown/checkbox options from the API (unfiltered legacy). */
export async function fetchConfigOptions(): Promise<ConfigOptions> {
  const response = await fetch(`${API_BASE}/config/options`, {
    cache: "no-store",
  });
  return parseJson<ConfigOptions>(response);
}

/** Fetch LLM model options for a provider and thinking mode. */
export async function fetchProviderModels(
  provider: string,
  mode: ModelMode,
): Promise<ProviderModelsResponse> {
  const response = await fetch(
    `${API_BASE}/config/providers/${encodeURIComponent(provider)}/models`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(await buildUserHeaders()),
      },
      body: JSON.stringify({ mode }),
      cache: "no-store",
    },
  );
  return parseJson<ProviderModelsResponse>(response);
}

/** Create a new analysis session. Credentials are loaded server-side. */
export async function createSession(config: CreateSessionRequest): Promise<Session> {
  const { providerCredentials: _ignored, ...payload } = config;
  const response = await fetch(`${API_BASE}/sessions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(await buildUserHeaders()),
    },
    body: JSON.stringify(payload),
  });
  return parseJson<Session>(response);
}

/** Fetch session metadata (ticker, config, status). Public for share-by-link. */
export async function fetchSession(sessionId: string): Promise<Session> {
  const response = await fetch(`${API_BASE}/sessions/${encodeURIComponent(sessionId)}`, {
    headers: await buildAuthHeaders(),
    cache: "no-store",
  });
  return parseJson<Session>(response);
}

/** List recent analysis sessions. */
export async function fetchSessions(
  limit = 20,
  offset = 0,
): Promise<SessionListResponse> {
  const params = new URLSearchParams({
    limit: String(limit),
    offset: String(offset),
  });
  const response = await fetch(`${API_BASE}/sessions?${params.toString()}`, {
    headers: await buildAuthHeaders(),
    cache: "no-store",
  });
  return parseJson<SessionListResponse>(response);
}

/** Submit product feedback (emailed via the API; no local persistence). */
export async function submitFeedback(
  body: FeedbackRequest,
): Promise<FeedbackResponse> {
  const response = await fetch(`${API_BASE}/feedback`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(await buildUserHeaders()),
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  return parseJson<FeedbackResponse>(response);
}

/** Permanently delete a session and its stored events. */
export async function deleteSession(sessionId: string): Promise<void> {
  const response = await fetch(`${API_BASE}/sessions/${encodeURIComponent(sessionId)}`, {
    method: "DELETE",
    headers: await buildAuthHeaders(),
  });
  if (!response.ok && response.status !== 204) {
    await parseJson(response);
  }
}

/** Fetch the final report for a completed session. Public for share-by-link. */
export async function fetchSessionReport(sessionId: string): Promise<SessionReport> {
  const response = await fetch(
    `${API_BASE}/sessions/${encodeURIComponent(sessionId)}/report`,
    {
      headers: await buildAuthHeaders(),
      cache: "no-store",
    },
  );
  return parseJson<SessionReport>(response);
}

export async function fetchSessionTradeCheck(
  sessionId: string,
): Promise<SessionTradeCheckResponse> {
  const response = await fetch(
    `${API_BASE}/sessions/${encodeURIComponent(sessionId)}/trade-check`,
    {
      headers: await buildAuthHeaders(),
      cache: "no-store",
    },
  );
  return parseJson<SessionTradeCheckResponse>(response);
}

/** Fetch all persisted events for a session (historical replay). */
export async function fetchSessionEvents(sessionId: string): Promise<SessionEventsResponse> {
  const response = await fetch(
    `${API_BASE}/sessions/${encodeURIComponent(sessionId)}/events`,
    {
      headers: await buildAuthHeaders(),
      cache: "no-store",
    },
  );
  return parseJson<SessionEventsResponse>(response);
}

export interface SessionStreamCallbacks {
  onEvent: <T extends SseEventType>(event: T, data: SseEventMap[T]) => void;
  onOpen?: () => void;
  /** Stream closed after a normal terminal event (run.completed / run.error). */
  onStreamEnd?: () => void;
  onError?: (error: Error) => void;
  /** Called before an intentional SSE reconnect (Vercel duration rotation). */
  onReconnect?: () => void;
}

export interface SessionStreamOptions {
  /** Restart the SSE connection before serverless timeout (default 4:30). */
  rotateMs?: number;
}

const SSE_EVENT_TYPES: SseEventType[] = [
  "run.started",
  "run.heartbeat",
  "agent.status",
  "message",
  "tool.call",
  "report.section",
  "stats",
  "trade.check",
  "run.completed",
  "run.error",
];

function buildStreamUrl(sessionId: string, liveOnly: boolean): string {
  const base = `/api/sessions/${encodeURIComponent(sessionId)}/stream`;
  return liveOnly ? `${base}?live=1` : base;
}

/** Subscribe to SSE stream for a running session. Returns an unsubscribe function. */
export function subscribeToSessionStream(
  sessionId: string,
  callbacks: SessionStreamCallbacks,
  options: SessionStreamOptions = {},
): () => void {
  const rotateMs = options.rotateMs ?? SESSION_STREAM_ROTATE_MS;
  let eventSource: EventSource | null = null;
  let rotateTimer: ReturnType<typeof setTimeout> | null = null;
  let terminal = false;
  let closed = false;
  let connectionGen = 0;
  let lastEventId = 0;

  function clearRotateTimer() {
    if (rotateTimer !== null) {
      clearTimeout(rotateTimer);
      rotateTimer = null;
    }
  }

  function applyStoredEvent(item: SessionEventsResponse["items"][number]) {
    if (!SSE_EVENT_TYPES.includes(item.type as SseEventType)) {
      return;
    }

    const eventType = item.type as SseEventType;
    callbacks.onEvent(eventType, item.payload as unknown as SseEventMap[typeof eventType]);
    if (eventType === "run.completed" || eventType === "run.error") {
      terminal = true;
      clearRotateTimer();
    }
  }

  async function refreshLastEventId() {
    try {
      const { items } = await fetchSessionEvents(sessionId);
      if (items.length > 0) {
        lastEventId = Math.max(lastEventId, ...items.map((item) => item.id));
      }
    } catch {
      // Best-effort sync; rotation will retry.
    }
  }

  async function syncMissedEvents() {
    try {
      const { items } = await fetchSessionEvents(sessionId);
      for (const item of items) {
        if (item.id <= lastEventId) {
          continue;
        }
        applyStoredEvent(item);
        lastEventId = item.id;
      }
    } catch {
      // Rotation still proceeds; the next reconnect can retry.
    }
  }

  async function rotateConnection() {
    if (terminal || closed) {
      return;
    }

    callbacks.onReconnect?.();
    await refreshLastEventId();

    const staleSource = eventSource;
    connectionGen += 1;
    staleSource?.close();
    eventSource = null;

    await syncMissedEvents();
    if (terminal || closed) {
      return;
    }

    connect(true);
  }

  function scheduleRotation() {
    clearRotateTimer();
    if (terminal || closed) {
      return;
    }

    rotateTimer = setTimeout(() => {
      void rotateConnection();
    }, rotateMs);
  }

  function connect(liveOnly: boolean) {
    if (closed || terminal) {
      return;
    }

    const gen = connectionGen;
    const source = new EventSource(buildStreamUrl(sessionId, liveOnly));
    eventSource = source;

    source.onopen = () => {
      if (gen !== connectionGen) {
        return;
      }
      callbacks.onOpen?.();
      void refreshLastEventId();
      scheduleRotation();
    };

    for (const eventType of SSE_EVENT_TYPES) {
      source.addEventListener(eventType, (raw) => {
        if (gen !== connectionGen) {
          return;
        }

        try {
          const data = JSON.parse((raw as MessageEvent).data) as SseEventMap[typeof eventType];
          callbacks.onEvent(eventType, data);
          if (eventType === "run.completed" || eventType === "run.error") {
            terminal = true;
            clearRotateTimer();
          }
        } catch (error) {
          callbacks.onError?.(
            error instanceof Error ? error : new Error("Failed to parse SSE event"),
          );
        }
      });
    }

    source.onerror = () => {
      if (gen !== connectionGen) {
        return;
      }

      clearRotateTimer();
      source.close();
      if (eventSource === source) {
        eventSource = null;
      }

      if (closed) {
        return;
      }

      if (terminal) {
        callbacks.onStreamEnd?.();
        return;
      }

      void (async () => {
        try {
          const session = await fetchSession(sessionId);
          if (session.status === "completed") {
            terminal = true;
            callbacks.onEvent("run.completed", {
              sessionId,
              decision: null,
            });
            callbacks.onStreamEnd?.();
            return;
          }
          if (session.status === "error") {
            terminal = true;
            callbacks.onEvent("run.error", {
              message: session.error ?? "Run failed",
            });
            return;
          }
          if (session.status === "cancelled") {
            terminal = true;
            callbacks.onEvent("run.error", {
              message: "Run cancelled",
              hint: "This analysis was cancelled.",
            });
            return;
          }
        } catch {
          // Fall through to connection error below.
        }

        if (!terminal && !closed) {
          callbacks.onError?.(new Error("Session stream connection error"));
        }
      })();
    };
  }

  connect(false);

  return () => {
    closed = true;
    connectionGen += 1;
    clearRotateTimer();
    eventSource?.close();
    eventSource = null;
  };
}

export { API_BASE };
