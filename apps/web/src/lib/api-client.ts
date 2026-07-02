/**
 * @file apps/web/src/lib/api-client.ts
 * HTTP and SSE client for the TradingAgents backend API.
 */

import type {
  ConfigOptions,
  CreateSessionRequest,
  CredentialsSchemaResponse,
  ModelMode,
  ProviderCredentials,
  ProviderModelsResponse,
  ResolvedConfigResponse,
  Session,
  SessionListResponse,
  SessionReport,
  SseEventMap,
  SseEventType,
  StoredCredentialsResponse,
  UpdateUserRequest,
  User,
} from "@tradingagents/api-types";
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

/** Fetch session metadata (ticker, config, status). */
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

/** Fetch the final report for a completed session. */
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

export interface SessionStreamCallbacks {
  onEvent: <T extends SseEventType>(event: T, data: SseEventMap[T]) => void;
  onOpen?: () => void;
  /** Stream closed after a normal terminal event (run.completed / run.error). */
  onStreamEnd?: () => void;
  onError?: (error: Error) => void;
}

const SSE_EVENT_TYPES: SseEventType[] = [
  "run.started",
  "run.heartbeat",
  "agent.status",
  "message",
  "tool.call",
  "report.section",
  "stats",
  "run.completed",
  "run.error",
];

/** Subscribe to SSE stream for a running session. Returns an unsubscribe function. */
export function subscribeToSessionStream(
  sessionId: string,
  callbacks: SessionStreamCallbacks,
): () => void {
  const url = `/api/sessions/${encodeURIComponent(sessionId)}/stream`;
  const eventSource = new EventSource(url);
  let terminal = false;

  eventSource.onopen = () => {
    callbacks.onOpen?.();
  };

  for (const eventType of SSE_EVENT_TYPES) {
    eventSource.addEventListener(eventType, (raw) => {
      try {
        const data = JSON.parse((raw as MessageEvent).data) as SseEventMap[typeof eventType];
        callbacks.onEvent(eventType, data);
        if (eventType === "run.completed" || eventType === "run.error") {
          terminal = true;
        }
      } catch (error) {
        callbacks.onError?.(
          error instanceof Error ? error : new Error("Failed to parse SSE event"),
        );
      }
    });
  }

  eventSource.onerror = () => {
    eventSource.close();

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

      if (!terminal) {
        callbacks.onError?.(new Error("Session stream connection error"));
      }
    })();
  };

  return () => {
    eventSource.close();
  };
}

export { API_BASE };
