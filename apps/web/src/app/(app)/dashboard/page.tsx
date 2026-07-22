/**
 * @file apps/web/src/app/(app)/dashboard/page.tsx
 * Authenticated home — recent sessions always; new analysis only when subscribed.
 */

import { Suspense } from "react";
import type { Session } from "@tradingagents/api-types";
import DashboardNewAnalysisSection from "@/components/DashboardNewAnalysisSection";
import RecentSessionsPanel from "@/components/RecentSessionsPanel";
import RecentSessionsSkeleton from "@/components/RecentSessionsSkeleton";
import { fetchSessionsServer } from "@/lib/api-server";

async function DashboardBody() {
  let sessions: Session[] = [];
  let loadError = false;
  try {
    const response = await fetchSessionsServer(15, 0);
    sessions = response.items;
  } catch {
    loadError = true;
  }

  return (
    <>
      <RecentSessionsPanel sessions={sessions} loadError={loadError} />
      <Suspense fallback={<RecentSessionsSkeleton />}>
        <DashboardNewAnalysisSection hasExistingReports={sessions.length > 0} />
      </Suspense>
    </>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<RecentSessionsSkeleton />}>
      <DashboardBody />
    </Suspense>
  );
}
