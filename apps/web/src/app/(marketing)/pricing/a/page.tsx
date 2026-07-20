/**
 * @file apps/web/src/app/(marketing)/pricing/a/page.tsx
 * Pricing layout option A — dual cards.
 */

import type { Metadata } from "next";
import PricingBackLink from "@/components/pricing/PricingBackLink";
import PricingLayoutA from "@/components/pricing/PricingLayoutA";

export const metadata: Metadata = {
  title: "Pricing layout A — TradingAgents",
  description: "Dual-card pricing layout preview for TradingAgents.",
};

export default function PricingLayoutAPage() {
  return (
    <>
      <PricingBackLink />
      <PricingLayoutA />
    </>
  );
}
