/**
 * @file apps/web/src/app/(marketing)/checkout/page.tsx
 * Checkout entry — Clerk account, then Stripe Managed Payments.
 */

import type { Metadata } from "next";
import { Suspense } from "react";
import CheckoutLoading from "@/components/pricing/CheckoutLoading";
import CheckoutScaffold from "@/components/pricing/CheckoutScaffold";

export const metadata: Metadata = {
  title: "Checkout — TradingAgents",
  description:
    "Start a free 14-day TradingAgents trial — no credit card needed. Subscribe with Stripe whenever you’re ready.",
};

export default function CheckoutPage() {
  return (
    <Suspense fallback={<CheckoutLoading />}>
      <CheckoutScaffold />
    </Suspense>
  );
}
