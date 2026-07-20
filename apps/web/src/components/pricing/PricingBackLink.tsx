/**
 * @file apps/web/src/components/pricing/PricingBackLink.tsx
 * Shared back navigation for pricing layout previews.
 */

import Link from "next/link";
import styles from "./PricingBackLink.module.css";

interface PricingBackLinkProps {
  href?: string;
  label?: string;
}

export default function PricingBackLink({
  href = "/pricing",
  label = "← All layout options",
}: PricingBackLinkProps) {
  return (
    <div className={styles.wrap}>
      <Link href={href} className={styles.link}>
        {label}
      </Link>
    </div>
  );
}
