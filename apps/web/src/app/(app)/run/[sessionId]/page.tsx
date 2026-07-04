/**
 * @file apps/web/src/app/run/[sessionId]/page.tsx
 * Streaming run page for an active or completed analysis session.
 */

import { Suspense } from "react";
import RunView from "@/components/RunView";
import RunViewSkeleton from "@/components/RunViewSkeleton";
import { fetchSessionServer } from "@/lib/api-server";

interface RunPageProps {
  params: Promise<{
    sessionId: string;
  }>;
}

async function RunPageContent({ sessionId }: { sessionId: string }) {
  let initialSession;
  try {
    initialSession = await fetchSessionServer(sessionId);
  } catch {
    // RunView still connects to the live stream if metadata fetch fails.
  }

  return <RunView sessionId={sessionId} initialSession={initialSession} />;
}

export default async function RunPage({ params }: RunPageProps) {
  const { sessionId } = await params;
  return (
    <Suspense fallback={<RunViewSkeleton />}>
      <RunPageContent sessionId={sessionId} />
    </Suspense>
  );
}
