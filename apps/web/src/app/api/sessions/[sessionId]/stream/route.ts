/**
 * @file apps/web/src/app/api/sessions/[sessionId]/stream/route.ts
 * Authenticated SSE proxy — EventSource cannot send Authorization headers directly.
 */

import { auth } from "@clerk/nextjs/server";
import { API_BASE } from "@/lib/api-client";

export async function GET(
  _request: Request,
  context: { params: { sessionId: string } },
): Promise<Response> {
  const { getToken } = await auth();
  const token = await getToken();
  if (!token) {
    return new Response("Unauthorized", { status: 401 });
  }

  const upstream = await fetch(
    `${API_BASE}/sessions/${encodeURIComponent(context.params.sessionId)}/stream`,
    {
      headers: { Authorization: `Bearer ${token}` },
    },
  );

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
