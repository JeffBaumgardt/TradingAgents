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

const AGENTS_SERVICE_URL =
  process.env.AGENTS_SERVICE_URL ?? "http://localhost:8000";

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
    throw new Error(`Agents service error (${response.status}): ${body}`);
  }

  return response.json() as Promise<T>;
}

export async function checkAgentsHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${AGENTS_SERVICE_URL}/health`);
    return response.ok;
  } catch {
    return false;
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

export async function fetchRunReport(runId: string): Promise<{
  markdown: string;
  sections: Record<string, string | null>;
  decision: string | null;
}> {
  return request(`/internal/runs/${runId}/report`);
}
