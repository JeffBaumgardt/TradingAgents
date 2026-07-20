/**
 * @file apps/web/src/components/pricing/PricingLayoutA.tsx
 * Layout A — classic dual pricing cards with billing toggle.
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
  PRICING_SHARED_FEATURES,
  type BillingInterval,
} from "@/lib/pricing-content";
import shared from "./pricing-shared.module.css";
import styles from "./PricingLayoutA.module.css";

interface PricingLayoutAProps {
  showLayoutLabel?: boolean;
}

export default function PricingLayoutA({ showLayoutLabel = false }: PricingLayoutAProps) {
  const [interval, setInterval] = useState<BillingInterval>("monthly");

  function handleIntervalChange(next: BillingInterval) {
    setInterval(next);
  }

  return (
    <div className={styles.page}>
      <header className={styles.hero}>
        <p className={shared.eyebrow}>
          {showLayoutLabel ? `${PRICING_PAGE.eyebrow} · Layout A` : PRICING_PAGE.eyebrow}
        </p>
        <h1 className={styles.title}>{PRICING_PAGE.title}</h1>
        <p className={styles.intro}>{PRICING_PAGE.intro}</p>
        <PricingBillingToggle
          value={interval}
          onChange={handleIntervalChange}
          idPrefix="layout-a"
        />
        <p className={styles.annualHint}>{PRICING_PAGE.annualNote}</p>
      </header>

      <section className={styles.cards} aria-label="Pricing plans">
        {PRICING_PLANS.map((plan) => {
          const price = displayPriceCents(plan, interval);
          const featured = plan.id === "byok";

          return (
            <article
              key={plan.id}
              className={featured ? styles.cardFeatured : styles.card}
              aria-labelledby={`plan-${plan.id}-title`}
            >
              {featured ? <p className={styles.cardBadge}>Most approachable</p> : null}
              <h2 id={`plan-${plan.id}-title`} className={styles.cardTitle}>
                {plan.name}
                {plan.priceProvisional ? (
                  <span className={shared.provisional}>Provisional</span>
                ) : null}
              </h2>
              <p className={styles.cardTagline}>{plan.tagline}</p>
              <p className={styles.priceRow}>
                <span className={styles.price}>{formatUsdFromCents(price)}</span>
                <span className={styles.priceSuffix}>/ month</span>
              </p>
              <p className={styles.priceCaption}>{displayPriceCaption(plan, interval)}</p>
              <p className={styles.bestFor}>{plan.bestFor}</p>
              <ul className={shared.featureList}>
                {plan.highlights.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
              <Link
                href={buildCheckoutHref(plan.id, interval)}
                className={featured ? shared.primaryButton : shared.secondaryButton}
                aria-label={`${plan.ctaLabel} — ${plan.name}`}
              >
                {plan.ctaLabel}
              </Link>
            </article>
          );
        })}
      </section>

      <section className={styles.sharedBand} aria-labelledby="shared-features-a">
        <h2 id="shared-features-a" className={styles.bandTitle}>
          Included with every plan
        </h2>
        <ul className={styles.sharedGrid}>
          {PRICING_SHARED_FEATURES.map((feature) => (
            <li key={feature.title}>
              <strong>{feature.title}</strong>
              <span>{feature.description}</span>
            </li>
          ))}
        </ul>
      </section>

      <p className={shared.note}>{PRICING_PAGE.infraFraming}</p>
      <p className={shared.note}>{PRICING_PAGE.provisionalNote}</p>
    </div>
  );
}
