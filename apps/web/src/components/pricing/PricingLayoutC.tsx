/**
 * @file apps/web/src/components/pricing/PricingLayoutC.tsx
 * Layout C — editorial “choose your path” with marketing imagery.
 */

"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import PricingBillingToggle from "@/components/pricing/PricingBillingToggle";
import {
  buildCheckoutHref,
  displayPriceCaption,
  displayPriceCents,
  formatUsdFromCents,
  getPricingPlan,
  PRICING_PAGE,
  PRICING_SHARED_FEATURES,
  type BillingInterval,
} from "@/lib/pricing-content";
import shared from "./pricing-shared.module.css";
import styles from "./PricingLayoutC.module.css";

const PATHS = [
  {
    planId: "byok" as const,
    pathLabel: "Path 1",
    imageSrc: "/images/landing/set-b-thesis-builder.png",
    imageAlt: "Modular research blocks assembling into a structured investment thesis",
    reverse: false,
  },
  {
    planId: "hosted" as const,
    pathLabel: "Path 2",
    imageSrc: "/images/landing/set-b-market-signals.png",
    imageAlt: "AI assistant surrounded by floating market data, news, and chart panels",
    reverse: true,
  },
] as const;

export default function PricingLayoutC() {
  const [interval, setInterval] = useState<BillingInterval>("monthly");

  function handleIntervalChange(next: BillingInterval) {
    setInterval(next);
  }

  return (
    <div className={styles.page}>
      <header className={styles.hero}>
        <div className={styles.heroCopy}>
          <p className={shared.eyebrow}>{PRICING_PAGE.eyebrow} · Layout C</p>
          <h1 className={styles.title}>Choose how you power the agents</h1>
          <p className={styles.intro}>{PRICING_PAGE.intro}</p>
          <PricingBillingToggle
            value={interval}
            onChange={handleIntervalChange}
            idPrefix="layout-c"
          />
          <p className={styles.annualHint}>{PRICING_PAGE.annualNote}</p>
        </div>
        <div className={styles.heroVisual}>
          <Image
            src="/images/landing/set-b-watchlist-intelligence.png"
            alt="Smart watchlist cards floating over a city skyline at dawn"
            width={1280}
            height={720}
            priority
            className={styles.heroImage}
          />
        </div>
      </header>

      <section className={styles.paths} aria-label="Pricing paths">
        {PATHS.map((path) => {
          const plan = getPricingPlan(path.planId);
          const price = displayPriceCents(plan, interval);

          return (
            <article
              key={plan.id}
              className={path.reverse ? styles.pathReverse : styles.path}
              aria-labelledby={`path-${plan.id}-title`}
            >
              <div className={styles.pathVisual}>
                <Image
                  src={path.imageSrc}
                  alt={path.imageAlt}
                  width={1280}
                  height={720}
                  className={styles.pathImage}
                />
              </div>
              <div className={styles.pathCopy}>
                <p className={styles.pathLabel}>{path.pathLabel}</p>
                <h2 id={`path-${plan.id}-title`} className={styles.pathTitle}>
                  {plan.name}
                  {plan.priceProvisional ? (
                    <span className={shared.provisional}>Provisional</span>
                  ) : null}
                </h2>
                <p className={styles.pathTagline}>{plan.tagline}</p>
                <p className={styles.priceRow}>
                  <span className={styles.price}>{formatUsdFromCents(price)}</span>
                  <span className={styles.priceSuffix}>/ month</span>
                </p>
                <p className={styles.priceCaption}>{displayPriceCaption(plan, interval)}</p>
                <ul className={shared.featureList}>
                  {plan.highlights.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
                <Link
                  href={buildCheckoutHref(plan.id, interval)}
                  className={shared.primaryButton}
                  aria-label={plan.ctaLabel}
                >
                  {plan.ctaLabel}
                </Link>
              </div>
            </article>
          );
        })}
      </section>

      <section className={styles.sharedBand} aria-labelledby="shared-features-c">
        <h2 id="shared-features-c" className={styles.bandTitle}>
          Built into the research workspace
        </h2>
        <ul className={styles.sharedList}>
          {PRICING_SHARED_FEATURES.map((feature) => (
            <li key={feature.title}>
              <strong>{feature.title}</strong>
              <span>{feature.description}</span>
            </li>
          ))}
        </ul>
        <p className={shared.note}>{PRICING_PAGE.infraFraming}</p>
        <p className={shared.note}>{PRICING_PAGE.provisionalNote}</p>
      </section>
    </div>
  );
}
