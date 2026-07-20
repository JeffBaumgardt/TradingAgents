/**
 * @file apps/web/src/components/pricing/PricingLayoutB.tsx
 * Layout B — comparison matrix with plan columns and CTAs.
 */

"use client";

import Link from "next/link";
import { useState } from "react";
import PricingBillingToggle from "@/components/pricing/PricingBillingToggle";
import {
  buildCheckoutHref,
  displayPriceCaption,
  displayPriceCents,
  formatUsdFromCents,
  PRICING_PAGE,
  PRICING_PLANS,
  type BillingInterval,
} from "@/lib/pricing-content";
import shared from "./pricing-shared.module.css";
import styles from "./PricingLayoutB.module.css";

export default function PricingLayoutB() {
  const [interval, setInterval] = useState<BillingInterval>("monthly");

  function handleIntervalChange(next: BillingInterval) {
    setInterval(next);
  }

  const byok = PRICING_PLANS[0]!;
  const hosted = PRICING_PLANS[1]!;
  const byokMonthlyLabel = formatUsdFromCents(displayPriceCents(byok, interval));

  const matrixRows = [
    {
      label: "Platform / infrastructure fee",
      byok: `Yes — ${byokMonthlyLabel}/mo keeps the app online`,
      hosted: "Included in plan price",
    },
    {
      label: "Model API keys",
      byok: "You bring your own",
      hosted: "We provide them",
    },
    {
      label: "Model catalog",
      byok: "Whatever your provider supports",
      hosted: "Wide curated array of models",
    },
    {
      label: "Token / usage billing",
      byok: "Billed by your provider",
      hosted: "Bundled into the hosted plan",
    },
    {
      label: "Detailed charts",
      byok: "Included",
      hosted: "Included",
    },
    {
      label: "Share reports by link",
      byok: "Included",
      hosted: "Included",
    },
    {
      label: "In-product feedback",
      byok: "Included",
      hosted: "Included",
    },
  ] as const;

  return (
    <div className={styles.page}>
      <header className={styles.hero}>
        <p className={shared.eyebrow}>{PRICING_PAGE.eyebrow} · Layout B</p>
        <h1 className={styles.title}>Compare plans at a glance</h1>
        <p className={styles.intro}>{PRICING_PAGE.intro}</p>
        <PricingBillingToggle
          value={interval}
          onChange={handleIntervalChange}
          idPrefix="layout-b"
        />
      </header>

      <div className={styles.tableWrap} role="region" aria-label="Plan comparison">
        <table className={styles.table}>
          <caption className={styles.caption}>
            TradingAgents plan comparison · {PRICING_PAGE.annualNote}
          </caption>
          <thead>
            <tr>
              <th scope="col">Capability</th>
              <th scope="col">
                <div className={styles.planHead}>
                  <span className={styles.planName}>{byok.name}</span>
                  <span className={styles.planPrice}>
                    {formatUsdFromCents(displayPriceCents(byok, interval))}
                    <span>/ mo</span>
                  </span>
                  <span className={styles.planCaption}>
                    {displayPriceCaption(byok, interval)}
                  </span>
                  <Link
                    href={buildCheckoutHref(byok.id, interval)}
                    className={shared.primaryButton}
                    aria-label={byok.ctaLabel}
                  >
                    {byok.ctaLabel}
                  </Link>
                </div>
              </th>
              <th scope="col">
                <div className={styles.planHead}>
                  <span className={styles.planName}>
                    {hosted.name}
                    {hosted.priceProvisional ? (
                      <span className={shared.provisional}>Provisional</span>
                    ) : null}
                  </span>
                  <span className={styles.planPrice}>
                    {formatUsdFromCents(displayPriceCents(hosted, interval))}
                    <span>/ mo</span>
                  </span>
                  <span className={styles.planCaption}>
                    {displayPriceCaption(hosted, interval)}
                  </span>
                  <Link
                    href={buildCheckoutHref(hosted.id, interval)}
                    className={shared.secondaryButton}
                    aria-label={hosted.ctaLabel}
                  >
                    {hosted.ctaLabel}
                  </Link>
                </div>
              </th>
            </tr>
          </thead>
          <tbody>
            {matrixRows.map((row) => (
              <tr key={row.label}>
                <th scope="row">{row.label}</th>
                <td>{row.byok}</td>
                <td>{row.hosted}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <aside className={styles.callout} aria-label="Platform fee framing">
        <h2 className={styles.calloutTitle}>
          Why a {byokMonthlyLabel} platform fee?
        </h2>
        <p className={styles.calloutCopy}>{PRICING_PAGE.infraFraming}</p>
        <p className={shared.note}>{PRICING_PAGE.provisionalNote}</p>
      </aside>
    </div>
  );
}
