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
      <Suspense fallback={<RecentSessionsSkeleton />}>
        <RecentSessionsPanel />
      </Suspense>

      <section aria-labelledby="new-analysis-heading">
        <h2 id="new-analysis-heading" className="pageTitle">
          Start a new analysis
        </h2>
        <p className="muted pageIntro">
          Walk through a short setup to choose a ticker, optional personal context, and which
          AI agents should collaborate. When you are ready, the run page streams live progress
          and finished reports — no refresh needed.
        </p>
        <Wizard />
      </section>
    </CredentialsGate>
  );
}
