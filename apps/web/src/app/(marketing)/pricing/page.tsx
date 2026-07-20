/**
 * @file apps/web/src/app/(marketing)/pricing/page.tsx
 * Pricing layout chooser — pick A/B/C, then delete the rest later.
 */

import type { Metadata } from "next";
import PricingChooser from "@/components/pricing/PricingChooser";

export const metadata: Metadata = {
  title: "Pricing — TradingAgents",
  description:
    "Bring your own API key for $3/month, or use hosted models. Annual plans save 20%.",
};

export default function PricingPage() {
  return <PricingChooser />;
}
