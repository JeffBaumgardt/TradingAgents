/**
 * @file apps/web/src/components/pricing/PricingChooser.tsx
 * Temporary chooser so stakeholders can preview three pricing layouts.
 */

import Link from "next/link";
import { PRICING_LAYOUT_OPTIONS, PRICING_PAGE } from "@/lib/pricing-content";
import shared from "./pricing-shared.module.css";
import styles from "./PricingChooser.module.css";

export default function PricingChooser() {
  return (
    <div className={styles.page}>
      <header className={styles.hero}>
        <p className={shared.eyebrow}>{PRICING_PAGE.eyebrow}</p>
        <h1 className={styles.title}>Pick a pricing layout</h1>
        <p className={styles.intro}>
          Three layout options share the same plans and copy. Preview each, then delete the ones
          you do not want. The live `/pricing` page currently shows Layout A until you choose.
        </p>
      </header>

      <ul className={styles.options} aria-label="Pricing layout options">
        {PRICING_LAYOUT_OPTIONS.map((option) => (
          <li key={option.id} className={styles.option}>
            <h2 className={styles.optionTitle}>{option.name}</h2>
            <p className={styles.optionSummary}>{option.summary}</p>
            <Link
              href={option.href}
              className={shared.primaryButton}
              aria-label={`Preview ${option.name}`}
            >
              Preview layout {option.id.toUpperCase()}
            </Link>
          </li>
        ))}
      </ul>

      <p className={shared.note}>{PRICING_PAGE.infraFraming}</p>
    </div>
  );
}
