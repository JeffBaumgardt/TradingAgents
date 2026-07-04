/**
 * @file apps/web/src/components/LandingPageContent.tsx
 * Set B marketing landing page sections and calls to action.
 */

import Image from "next/image";
import Link from "next/link";
import CookieAckBanner from "@/components/CookieAckBanner";
import {
  LANDING_DISCLAIMER,
  LANDING_FEATURES,
  LANDING_HERO,
} from "@/lib/landing-content";
import styles from "./LandingPageContent.module.css";

interface LandingPageContentProps {
  cookieAcknowledged: boolean;
}

export default function LandingPageContent({ cookieAcknowledged }: LandingPageContentProps) {
  return (
    <>
      <main id="main-content" className={styles.page}>
        <section className={styles.hero} aria-labelledby="landing-hero-heading">
        <div className={styles.heroCopy}>
          <p className={styles.eyebrow}>AI market research · Free to start</p>
          <h1 id="landing-hero-heading" className={styles.heroTitle}>
            {LANDING_HERO.headline}
          </h1>
          <p className={styles.heroIntro}>{LANDING_HERO.copy}</p>
          <div className={styles.heroActions}>
            <Link href="/sign-up" className={styles.primaryButton}>
              Create free account
            </Link>
            <Link href="/sign-in" className={styles.secondaryButton}>
              Sign in
            </Link>
          </div>
          <ul className={styles.heroHighlights} aria-label="Product highlights">
            <li>No credit card required</li>
            <li>Bring your own AI provider key</li>
            <li>Research only — not financial advice</li>
          </ul>
        </div>
        <div className={styles.heroVisual}>
          <Image
            src={LANDING_HERO.imageSrc}
            alt={LANDING_HERO.imageAlt}
            width={1280}
            height={720}
            priority
            className={styles.heroImage}
          />
        </div>
      </section>

      <section id="features" className={styles.features} aria-labelledby="features-heading">
        <div className={styles.sectionIntro}>
          <h2 id="features-heading" className={styles.sectionTitle}>
            Research smarter with specialized AI agents
          </h2>
          <p className={styles.sectionCopy}>
            TradingAgents coordinates multiple perspectives so you can move from noisy market data
            to structured research you can actually review and challenge.
          </p>
        </div>

        <div className={styles.featureList}>
          {LANDING_FEATURES.map((feature, index) => (
            <article
              key={feature.slug}
              id={feature.slug}
              className={`${styles.featureCard} ${index % 2 === 1 ? styles.featureCardReverse : ""}`}
              aria-labelledby={`${feature.slug}-heading`}
            >
              <div className={styles.featureVisual}>
                <Image
                  src={feature.imageSrc}
                  alt={feature.imageAlt}
                  width={1280}
                  height={720}
                  className={styles.featureImage}
                />
              </div>
              <div className={styles.featureCopy}>
                <h3 id={`${feature.slug}-heading`} className={styles.featureTitle}>
                  {feature.headline}
                </h3>
                <p className={styles.featureText}>{feature.copy}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.finalCta} aria-labelledby="final-cta-heading">
        <div className={styles.finalCtaInner}>
          <h2 id="final-cta-heading" className={styles.finalCtaTitle}>
            Start researching in minutes
          </h2>
          <p className={styles.finalCtaCopy}>
            Create a free account, add your provider API key, and launch your first multi-agent
            analysis run. No subscription required today.
          </p>
          <Link href="/sign-up" className={styles.primaryButton}>
            Get started free
          </Link>
        </div>
      </section>
      </main>

      <footer className={styles.footer}>
        <p className={styles.disclaimer}>{LANDING_DISCLAIMER}</p>
      </footer>

      <CookieAckBanner initialAcknowledged={cookieAcknowledged} />
    </>
  );
}
