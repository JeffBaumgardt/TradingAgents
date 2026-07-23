/**
 * @file apps/web/src/app/api/sessions/[sessionId]/chat/stream/route.ts
 * Authenticated SSE proxy for follow-up Portfolio Manager chat turns.
 */

import { auth } from "@clerk/nextjs/server";
import { API_BASE } from "@/lib/api-client";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: { params: Promise<{ sessionId: string }> },
): Promise<Response> {
  const { sessionId } = await context.params;
  const { getToken } = await auth();
  const token = await getToken();
  if (!token) {
    return new Response("Unauthorized", { status: 401 });
  }

  const turnId = new URL(request.url).searchParams.get("turnId");
  if (!turnId) {
    return new Response("turnId is required", { status: 400 });
  }

  const upstreamUrl = new URL(
    `${API_BASE}/sessions/${encodeURIComponent(sessionId)}/chat/stream`,
  );
  upstreamUrl.searchParams.set("turnId", turnId);

  const upstream = await fetch(upstreamUrl.toString(), {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!upstream.ok || !upstream.body) {
    return new Response(upstream.statusText, { status: upstream.status });
  }

  return new Response(upstream.body, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
