/**
 * @file apps/web/src/app/(marketing)/pricing/page.tsx
 * Public pricing page — dual-card layout (Layout A).
 */

import type { Metadata } from "next";
import PricingLayout from "@/components/pricing/PricingLayout";

export const metadata: Metadata = {
  title: "Pricing — TradingAgents",
  description:
    "Bring your own API key for $3/month, or use hosted models. Annual plans save 20%.",
};

export default function PricingPage() {
  return <PricingLayout />;
}
