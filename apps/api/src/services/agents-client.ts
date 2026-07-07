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

function formatAgentsTargetHint(body: string, status: number): string {
  try {
    const parsed = JSON.parse(body) as { error?: string; code?: string; service?: string };
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
  } catch {
    // body is not JSON — fall through
  }

  return `Agents service error (${status}): ${body}`;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${AGENTS_SERVICE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
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
  mode: "quick" | "deep",
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

export async function startRun(
  sessionId: string,
  config: CreateSessionRequest,
): Promise<{ runId: string }> {
  return request<{ runId: string }>("/internal/runs", {
    method: "POST",
    body: JSON.stringify({ sessionId, ...config }),
  });
}

export async function cancelRun(runId: string): Promise<void> {
  await request<{ ok: boolean }>(`/internal/runs/${runId}`, {
    method: "DELETE",
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
      headers: { "Content-Type": "application/json" },
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
  llmProvider?: string;
  quickThinkLlm?: string;
  backendUrl?: string | null;
  openaiReasoningEffort?: string | null;
  anthropicEffort?: string | null;
  googleThinkingLevel?: string | null;
  llmEnhance?: boolean;
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
