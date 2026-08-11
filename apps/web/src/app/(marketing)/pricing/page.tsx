/**
 * @file apps/web/src/app/(marketing)/pricing/page.tsx
 * Public pricing page — dual-card layout (Layout A).
 */

import type { Metadata } from "next";
import PricingLayout from "@/components/pricing/PricingLayout";

export const metadata: Metadata = {
  title: "Pricing — TradingAgents",
  description:
    "Standard $9 or Pro $19 — Agents Model included. 14-day free trial, no card. Annual saves 20%.",
};

export default function PricingPage() {
  return <PricingLayout />;
}
