/**
 * @file apps/web/src/components/TrialEndedModal.tsx
 * Non-closeable paywall after free trial ends — forces plan selection / sign-out.
 */

"use client";

import Link from "next/link";
import { useClerk } from "@clerk/nextjs";
import { useEffect, useId, useRef } from "react";
import {
  buildCheckoutHref,
  displayPriceCaption,
  displayPriceCents,
  formatUsdFromCents,
  PRICING_PLANS,
  PRICING_SHARED_FEATURES,
  type BillingInterval,
} from "@/lib/pricing-content";
import {
  getTrialEndedModalCopy,
  type TrialEndedModalVariant,
} from "@/lib/trial-ended-modal-content";
import styles from "./TrialEndedModal.module.css";

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';

interface TrialEndedModalProps {
  variant?: TrialEndedModalVariant;
}

export default function TrialEndedModal({
  variant = "trial_expired",
}: TrialEndedModalProps) {
  const { signOut } = useClerk();
  const titleId = useId();
  const descriptionId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const primaryCtaRef = useRef<HTMLAnchorElement>(null);
  const previousOverflowRef = useRef<string | null>(null);
  const copy = getTrialEndedModalCopy(variant);

  const interval: BillingInterval = "monthly";

  useEffect(() => {
    previousOverflowRef.current = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    primaryCtaRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      // Non-closeable: block Escape.
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        return;
      }

      if (event.key !== "Tab" || !dialogRef.current) {
        return;
      }

      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
      );

      if (focusable.length === 0) {
        event.preventDefault();
        dialogRef.current.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!first || !last) {
        return;
      }

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
        return;
      }

      if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown, true);
    return () => {
      document.removeEventListener("keydown", handleKeyDown, true);
      document.body.style.overflow = previousOverflowRef.current ?? "";
    };
  }, []);

  async function handleSignOut() {
    await signOut({ redirectUrl: "/" });
  }

  return (
    <div className={styles.backdrop} role="presentation">
      <div
        ref={dialogRef}
        className={styles.dialog}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        tabIndex={-1}
      >
        <p className={styles.eyebrow}>{copy.eyebrow}</p>
        <h2 id={titleId} className={styles.title}>
          {copy.title}
        </h2>
        <div id={descriptionId} className={styles.intro}>
          <p>{copy.intro}</p>
        </div>

        <section className={styles.benefits} aria-labelledby={`${titleId}-benefits`}>
          <h3 id={`${titleId}-benefits`} className={styles.benefitsTitle}>
            {copy.benefitsHeading}
          </h3>
          <ul className={styles.benefitsList}>
            {PRICING_SHARED_FEATURES.filter((feature) => feature.title !== "14-day free trial").map(
              (feature) => (
                <li key={feature.title}>
                  <strong>{feature.title}</strong>
                  <span>{feature.description}</span>
                </li>
              ),
            )}
            <li>
              <strong>{copy.continuityBenefit.title}</strong>
              <span>{copy.continuityBenefit.description}</span>
            </li>
          </ul>
        </section>

        <section className={styles.plans} aria-label="Subscription plans">
          {PRICING_PLANS.map((plan) => {
            const featured = plan.id === "pro" || plan.recommended;
            const price = displayPriceCents(plan, interval);
            const href = buildCheckoutHref(plan.id, interval);
            const ctaLabel =
              plan.id === "pro" ? copy.subscribeProLabel : copy.subscribeStandardLabel;

            return (
              <article
                key={plan.id}
                className={featured ? styles.planFeatured : styles.plan}
                aria-labelledby={`trial-end-plan-${plan.id}`}
              >
                {featured ? <p className={styles.planBadge}>Recommended</p> : null}
                <h3 id={`trial-end-plan-${plan.id}`} className={styles.planName}>
                  {plan.name}
                </h3>
                <p className={styles.planTagline}>{plan.tagline}</p>
                <p className={styles.planPrice}>
                  <span className={styles.planPriceValue}>{formatUsdFromCents(price)}</span>
                  <span className={styles.planPriceSuffix}>/ month</span>
                </p>
                <p className={styles.planCaption}>{displayPriceCaption(plan, interval)}</p>
                <ul className={styles.planHighlights}>
                  {plan.highlights.slice(0, 4).map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
                <Link
                  ref={featured ? primaryCtaRef : undefined}
                  href={href}
                  className={featured ? styles.primaryCta : styles.secondaryCta}
                  aria-label={`${ctaLabel} — ${formatUsdFromCents(price)} per month`}
                >
                  {ctaLabel}
                </Link>
              </article>
            );
          })}
        </section>

        <p className={styles.footerNote}>{copy.annualNote}</p>

        <div className={styles.footerActions}>
          <Link href="/pricing" className={styles.textLink}>
            {copy.comparePlansLabel}
          </Link>
          <button
            type="button"
            className={styles.signOutButton}
            onClick={() => {
              void handleSignOut();
            }}
            aria-label={copy.signOutLabel}
          >
            {copy.signOutLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
