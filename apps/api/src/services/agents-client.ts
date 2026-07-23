/**
 * apps/api/src/services/agents-client.ts
 *
 * HTTP client for the Python agents-service internal API.
 * The gateway delegates run execution and SSE streaming to this service.
 */

import type {
  ConfigOptions,
  CreateSessionRequest,
  CredentialsSchemaResponse,
  ProviderCredentials,
  ProviderModelsResponse,
  ResolvedConfigResponse,
} from "@tradingagents/api-types";

export const EXPECTED_AGENTS_SERVICE = "tradingagents-agents-service";

const AGENTS_SERVICE_URL =
  process.env.AGENTS_SERVICE_URL ?? "http://localhost:8000";

export type AgentsHealthStatus = {
  reachable: boolean;
  service?: string;
  misconfigured?: boolean;
  hint?: string;
};

/** Shared secret for API → agents-service /internal/* calls. */
export function getAgentsServiceToken(): string {
  return process.env.AGENTS_SERVICE_TOKEN?.trim() ?? "";
}

/** Headers for authenticated calls to agents-service (including SSE). */
export function agentsServiceAuthHeaders(
  extra?: Record<string, string>,
): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(extra ?? {}),
  };
  const token = getAgentsServiceToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

function formatAgentsTargetHint(body: string, status: number): string {
  try {
    const parsed = JSON.parse(body) as {
      error?: string;
      detail?: string;
      code?: string;
      service?: string;
    };
    if (parsed.code === "MISSING_SUPABASE_URL") {
      return (
        "AGENTS_SERVICE_URL is hitting a Node API instance (Supabase middleware error), not the Python agents-service. " +
        "Use the agents-service private domain on port 8000, e.g. http://<agents>.railway.internal:8000"
      );
    }
    if (parsed.service === "tradingagents-api") {
      return (
        "AGENTS_SERVICE_URL points at the Node API. Set it to the Python agents-service private URL on port 8000."
      );
    }
    if (
      parsed.code === "SERVICE_AUTH_FAILED" ||
      parsed.code === "SERVICE_AUTH_NOT_CONFIGURED"
    ) {
      return (
        `${parsed.detail ?? "Agents service authentication failed"}. ` +
        "Set the same AGENTS_SERVICE_TOKEN on both the API and agents-service."
      );
    }
  } catch {
    // body is not JSON — fall through
  }

  return `Agents service error (${status}): ${body}`;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${AGENTS_SERVICE_URL}${path}`, {
    ...init,
    headers: {
      ...agentsServiceAuthHeaders(),
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(formatAgentsTargetHint(body, response.status));
  }

  return response.json() as Promise<T>;
}

export async function checkAgentsHealth(): Promise<AgentsHealthStatus> {
  try {
    const response = await fetch(`${AGENTS_SERVICE_URL}/health`);
    if (!response.ok) {
      return {
        reachable: false,
        hint: `HTTP ${response.status} from ${AGENTS_SERVICE_URL}/health`,
      };
    }

    const body = (await response.json()) as { service?: string };
    if (body.service !== EXPECTED_AGENTS_SERVICE) {
      const misconfiguredHint =
        body.service === "tradingagents-api"
          ? "AGENTS_SERVICE_URL points at the Node API, not Python agents-service. Use the agents-service private domain on port 8000."
          : `Unexpected service "${body.service ?? "unknown"}" at AGENTS_SERVICE_URL (expected ${EXPECTED_AGENTS_SERVICE}).`;

      return {
        reachable: true,
        service: body.service,
        misconfigured: true,
        hint: misconfiguredHint,
      };
    }

    return { reachable: true, service: body.service };
  } catch (error) {
    return {
      reachable: false,
      hint: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function fetchCredentialsSchema(): Promise<CredentialsSchemaResponse> {
  return request<CredentialsSchemaResponse>("/internal/config/credentials/schema");
}

export async function resolveConfig(
  providerCredentials: ProviderCredentials,
): Promise<ResolvedConfigResponse> {
  return request<ResolvedConfigResponse>("/internal/config/resolve", {
    method: "POST",
    body: JSON.stringify({ providerCredentials }),
  });
}

export async function fetchConfigOptions(): Promise<ConfigOptions> {
  return request<ConfigOptions>("/internal/config/options");
}

export async function fetchProviderModels(
  provider: string,
  mode: "all" | "quick" | "deep" = "all",
  providerCredentials: ProviderCredentials = {},
): Promise<ProviderModelsResponse> {
  return request<ProviderModelsResponse>(
    `/internal/config/providers/${encodeURIComponent(provider)}/models`,
    {
      method: "POST",
      body: JSON.stringify({ mode, providerCredentials }),
    },
  );
}

/** Static model catalog — no user/platform credentials required. */
export async function fetchProviderModelsPublic(
  provider: string,
  mode: "all" | "quick" | "deep" = "all",
): Promise<ProviderModelsResponse> {
  return request<ProviderModelsResponse>(
    `/internal/config/providers/${encodeURIComponent(provider)}/models?mode=${encodeURIComponent(mode)}`,
  );
}

export async function startRun(
  sessionId: string,
  config: CreateSessionRequest,
): Promise<{ runId: string }> {
  return request<{ runId: string }>("/internal/runs", {
    method: "POST",
    body: JSON.stringify({ sessionId, ...config }),
  });
}

export type StartChatTurnPayload = {
  sessionId: string;
  assistantMessageId: string;
  userMessage: string;
  ticker: string;
  analysisDate: string;
  userContext?: string | null;
  decision?: string | null;
  reportSections: Record<string, string | null>;
  tradeCheck?: Record<string, unknown> | null;
  priorMessages: Array<{ role: string; content: string }>;
  llmProvider: string;
  backendUrl?: string | null;
  thinkLlm: string;
  googleThinkingLevel?: string | null;
  openaiReasoningEffort?: string | null;
  anthropicEffort?: string | null;
  providerCredentials?: ProviderCredentials;
};

export async function startChatTurn(
  payload: StartChatTurnPayload,
): Promise<{ turnId: string }> {
  return request<{ turnId: string }>("/internal/chat/turns", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function cancelChatTurn(
  turnId: string,
  reason?: { message?: string; hint?: string },
): Promise<void> {
  await request<{ ok: boolean }>(`/internal/chat/turns/${encodeURIComponent(turnId)}`, {
    method: "DELETE",
    body: reason ? JSON.stringify(reason) : undefined,
  });
}

export function getChatTurnStreamUrl(turnId: string): string {
  return `${AGENTS_SERVICE_URL}/internal/chat/turns/${encodeURIComponent(turnId)}/stream`;
}

export async function cancelRun(
  runId: string,
  reason?: { message?: string; hint?: string },
): Promise<void> {
  await request<{ ok: boolean }>(`/internal/runs/${runId}`, {
    method: "DELETE",
    body: reason ? JSON.stringify(reason) : undefined,
  });
}

export function getRunStreamUrl(runId: string): string {
  return `${AGENTS_SERVICE_URL}/internal/runs/${runId}/stream`;
}

export type RunStatusResponse = {
  runId: string;
  sessionId: string;
  status: string;
  error: string | null;
};

export async function fetchRunStatus(runId: string): Promise<RunStatusResponse | null> {
  const response = await fetch(
    `${AGENTS_SERVICE_URL}/internal/runs/${encodeURIComponent(runId)}`,
    {
      headers: agentsServiceAuthHeaders(),
    },
  );

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    const body = await response.text();
    throw new Error(formatAgentsTargetHint(body, response.status));
  }

  return response.json() as Promise<RunStatusResponse>;
}

export async function fetchRunReport(runId: string): Promise<{
  markdown: string;
  sections: Record<string, string | null>;
  decision: string | null;
  tradeCheck?: Record<string, unknown> | null;
}> {
  return request(`/internal/runs/${runId}/report`);
}

export interface RebuildTradeCheckRequest {
  sessionId?: string;
  ticker: string;
  analysisDate: string;
  userContext?: string | null;
  sections: Record<string, string | null>;
  toolEvents?: Array<Record<string, unknown>>;
}

export async function rebuildTradeCheck(
  body: RebuildTradeCheckRequest,
): Promise<{ tradeCheck: Record<string, unknown> }> {
  return request("/internal/trade-check/rebuild", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function getAgentsServiceUrl(): string {
  return AGENTS_SERVICE_URL;
}
