/**
 * @file apps/web/src/app/(app)/settings/billing/page.tsx
 * Signed-in subscription and hosted usage profile.
 */

import type { Metadata } from "next";
import Link from "next/link";
import BillingPageContent from "@/components/BillingPageContent";

export const metadata: Metadata = {
  title: "Billing — TradingAgents",
  description: "View your TradingAgents subscription and hosted model usage.",
};

export const dynamic = "force-dynamic";

export default function BillingSettingsPage() {
  return (
    <>
      <div style={{ marginBottom: "1.5rem" }}>
        <Link href="/dashboard" className="muted" style={{ textDecoration: "none" }}>
          ← Back to dashboard
        </Link>
      </div>
      <h1 className="pageTitle">Billing & usage</h1>
      <p className="muted pageIntro">
        See your plan, when the billing period resets, and how hosted model usage compares to runs
        on your own API keys.
      </p>
      <BillingPageContent />
    </>
  );
}
