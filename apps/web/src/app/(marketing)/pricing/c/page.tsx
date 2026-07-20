/**
 * @file apps/web/src/app/(marketing)/pricing/c/page.tsx
 * Pricing layout option C — choose your path.
 */

import type { Metadata } from "next";
import PricingBackLink from "@/components/pricing/PricingBackLink";
import PricingLayoutC from "@/components/pricing/PricingLayoutC";

export const metadata: Metadata = {
  title: "Pricing layout C — TradingAgents",
  description: "Editorial path pricing layout preview for TradingAgents.",
};

export default function PricingLayoutCPage() {
  return (
    <>
      <PricingBackLink />
      <PricingLayoutC />
    </>
  );
}
