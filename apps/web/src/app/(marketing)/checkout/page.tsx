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
  description: "Create your account and pay for a TradingAgents plan with Stripe Checkout.",
};

export default function CheckoutPage() {
  return (
    <Suspense fallback={<CheckoutLoading />}>
      <CheckoutScaffold />
    </Suspense>
  );
}
