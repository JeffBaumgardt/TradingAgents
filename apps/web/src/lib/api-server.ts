/**
 * @file apps/web/src/lib/api-server.ts
 * Server-only API fetchers with Next.js cache / revalidation.
 * Import only from Server Components, Route Handlers, or server actions.
 */

import "server-only";
import { auth } from "@clerk/nextjs/server";
import type {
  CredentialsSchemaResponse,
  Session,
  SessionListResponse,
} from "@tradingagents/api-types";
import { API_BASE } from "@/lib/api-client";

const SESSIONS_REVALIDATE_SECONDS = 15;
const SERVER_FETCH_TIMEOUT_MS = 5000;

async function buildServerAuthHeaders(): Promise<HeadersInit> {
  const { getToken } = await auth();
  const token = await getToken();
  if (!token) {
    throw new Error("Unauthorized");
  }
  return { Authorization: `Bearer ${token}` };
}

async function fetchWithTimeout(
  input: string,
  init?: RequestInit & { next?: { revalidate?: number } },
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), SERVER_FETCH_TIMEOUT_MS);

  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }
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
    throw new Error(message);
  }
  return (await response.json()) as T;
}

/** List recent analysis sessions (ISR-friendly). */
export async function fetchSessionsServer(
  limit = 20,
  offset = 0,
): Promise<SessionListResponse> {
  const params = new URLSearchParams({
    limit: String(limit),
    offset: String(offset),
  });
  const response = await fetchWithTimeout(`${API_BASE}/sessions?${params.toString()}`, {
    headers: await buildServerAuthHeaders(),
    next: { revalidate: SESSIONS_REVALIDATE_SECONDS },
  });
  return parseJson<SessionListResponse>(response);
}

/** Fetch session metadata for run page shell (short cache). */
export async function fetchSessionServer(sessionId: string): Promise<Session> {
  const response = await fetchWithTimeout(`${API_BASE}/sessions/${encodeURIComponent(sessionId)}`, {
    headers: await buildServerAuthHeaders(),
    next: { revalidate: SESSIONS_REVALIDATE_SECONDS },
  });
  return parseJson<Session>(response);
}

/** Credential field definitions — always fetch fresh so deploy-time schema changes show up. */
export async function fetchCredentialsSchemaServer(): Promise<CredentialsSchemaResponse> {
  const response = await fetchWithTimeout(`${API_BASE}/config/credentials/schema`, {
    cache: "no-store",
  });
  return parseJson<CredentialsSchemaResponse>(response);
}
