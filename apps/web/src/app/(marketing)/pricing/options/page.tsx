/**
 * @file apps/web/src/app/(marketing)/pricing/options/page.tsx
 * Temporary layout chooser — pick A/B/C, then delete the rest later.
 */

import type { Metadata } from "next";
import PricingBackLink from "@/components/pricing/PricingBackLink";
import PricingChooser from "@/components/pricing/PricingChooser";

export const metadata: Metadata = {
  title: "Pricing layout options — TradingAgents",
  description: "Preview three pricing page layout options for TradingAgents.",
};

export default function PricingOptionsPage() {
  return (
    <>
      <PricingBackLink href="/pricing" label="← Back to pricing" />
      <PricingChooser />
    </>
  );
}
