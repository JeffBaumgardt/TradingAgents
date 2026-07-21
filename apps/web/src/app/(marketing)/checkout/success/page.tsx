/**
 * @file apps/web/src/app/(marketing)/checkout/success/page.tsx
 * Post–Stripe Checkout success landing (Managed Payments).
 */

import type { Metadata } from "next";
import { Suspense } from "react";
import CheckoutSuccessContent from "@/components/pricing/CheckoutSuccessContent";
import CheckoutLoading from "@/components/pricing/CheckoutLoading";

export const metadata: Metadata = {
  title: "Payment complete — TradingAgents",
  description: "Your TradingAgents subscription checkout completed successfully.",
};

export default function CheckoutSuccessPage() {
  return (
    <Suspense fallback={<CheckoutLoading />}>
      <CheckoutSuccessContent />
    </Suspense>
  );
}
