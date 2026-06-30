/**
 * @file apps/web/src/app/run/[sessionId]/page.tsx
 * Streaming run page for an active or completed analysis session.
 */

import { Suspense } from "react";
import RunView from "@/components/RunView";
import RunViewSkeleton from "@/components/RunViewSkeleton";
import { fetchSessionServer } from "@/lib/api-server";

interface RunPageProps {
  params: {
    sessionId: string;
  };
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

export default function RunPage({ params }: RunPageProps) {
  return (
    <Suspense fallback={<RunViewSkeleton />}>
      <RunPageContent sessionId={params.sessionId} />
    </Suspense>
  );
}
