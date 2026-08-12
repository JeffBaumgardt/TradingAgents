/**
 * @file apps/web/src/app/(marketing)/billing-preview/page.tsx
 * Public UI preview of the billing/usage profile with sample data (for review).
 */

import type { Metadata } from "next";
import Link from "next/link";
import BillingAccountView from "@/components/BillingAccountView";
import { buildSampleBillingAccount } from "@/lib/billing-sample";

export const metadata: Metadata = {
  title: "Billing UI preview — TradingAgents",
  description: "Sample Standard/Pro billing and usage UI for design review.",
};

export default function BillingPreviewPage() {
  return (
    <div style={{ maxWidth: 920, margin: "0 auto", padding: "2rem 1.5rem 3rem" }}>
      <Link href="/pricing" className="muted" style={{ textDecoration: "none" }}>
        ← Back to pricing
      </Link>
      <h1 className="pageTitle" style={{ marginTop: "1rem" }}>
        Billing & usage (preview)
      </h1>
      <p className="muted pageIntro">
        Public preview with sample Pro-plan data so reviewers can inspect the progress bar, period
        reset, and Agents Model usage without signing in.
      </p>
      <BillingAccountView
        account={buildSampleBillingAccount()}
        previewBanner="Preview only — signed-in users see live data at /settings/billing."
      />
    </div>
  );
}
