/**
 * @file apps/web/src/app/page.tsx
 * Home page — recent sessions (SSR) and the analysis wizard (client).
 */

import { Suspense } from "react";
import CredentialsGate from "@/components/CredentialsGate";
import RecentSessionsPanel from "@/components/RecentSessionsPanel";
import RecentSessionsSkeleton from "@/components/RecentSessionsSkeleton";
import Wizard from "@/components/Wizard";

export default function HomePage() {
  return (
    <CredentialsGate>
      <section style={{ marginBottom: "2rem" }}>
        <h1 style={{ marginBottom: "0.25rem" }}>Recent Sessions</h1>
        <p className="muted" style={{ marginTop: 0, marginBottom: "1rem" }}>
          Review previous analyses by ticker and report date.
        </p>
        <Suspense fallback={<RecentSessionsSkeleton />}>
          <RecentSessionsPanel />
        </Suspense>
      </section>

      <section>
        <h2 style={{ marginBottom: "0.25rem" }}>New Analysis</h2>
        <p className="muted" style={{ marginTop: 0, marginBottom: "1.5rem" }}>
          Configure your trading analysis using the same steps as the CLI.
        </p>
        <Wizard />
      </section>
    </CredentialsGate>
  );
}
