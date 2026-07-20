/**
 * @file apps/web/src/app/(marketing)/checkout/page.tsx
 * Checkout entry point — scaffolds the future payment provider flow.
 */

import type { Metadata } from "next";
import { Suspense } from "react";
import CheckoutLoading from "@/components/pricing/CheckoutLoading";
import CheckoutScaffold from "@/components/pricing/CheckoutScaffold";

export const metadata: Metadata = {
  title: "Checkout — TradingAgents",
  description: "Start a TradingAgents subscription checkout (payment provider coming soon).",
};

export default function CheckoutPage() {
  return (
    <Suspense fallback={<CheckoutLoading />}>
      <CheckoutScaffold />
    </Suspense>
  );
}
