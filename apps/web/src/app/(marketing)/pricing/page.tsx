/**
 * @file apps/web/src/app/(marketing)/pricing/page.tsx
 * Public pricing page — Layout A by default while alternate layouts are compared.
 */

import type { Metadata } from "next";
import Link from "next/link";
import PricingLayoutA from "@/components/pricing/PricingLayoutA";
import styles from "@/components/pricing/PricingBackLink.module.css";

export const metadata: Metadata = {
  title: "Pricing — TradingAgents",
  description:
    "Bring your own API key for $3/month, or use hosted models. Annual plans save 20%.",
};

export default function PricingPage() {
  return (
    <>
      <div className={styles.wrap}>
        <Link href="/pricing/options" className={styles.link}>
          Compare layout options A / B / C
        </Link>
      </div>
      <PricingLayoutA />
    </>
  );
}
