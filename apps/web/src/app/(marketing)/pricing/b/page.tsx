/**
 * @file apps/web/src/app/(marketing)/pricing/b/page.tsx
 * Pricing layout option B — comparison matrix.
 */

import type { Metadata } from "next";
import PricingBackLink from "@/components/pricing/PricingBackLink";
import PricingLayoutB from "@/components/pricing/PricingLayoutB";

export const metadata: Metadata = {
  title: "Pricing layout B — TradingAgents",
  description: "Comparison-matrix pricing layout preview for TradingAgents.",
};

export default function PricingLayoutBPage() {
  return (
    <>
      <PricingBackLink />
      <PricingLayoutB />
    </>
  );
}
