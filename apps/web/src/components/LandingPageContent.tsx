/**
 * @file apps/web/src/components/LandingPageContent.tsx
 * Set B marketing landing page with TradingAgents Framework agent definitions.
 */

import Image from "next/image";
import Link from "next/link";
import CookieAckBanner from "@/components/CookieAckBanner";
import {
  LANDING_AGENT_TEAMS,
  LANDING_DISCLAIMER,
  LANDING_FRAMEWORK_INTRO,
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
            <p className={styles.eyebrow}>TradingAgents Framework · Free to start</p>
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

        <section id="framework" className={styles.features} aria-labelledby="framework-heading">
          <div className={styles.sectionIntro}>
            <h2 id="framework-heading" className={styles.sectionTitle}>
              Specialized agents, structured collaboration
            </h2>
            <p className={styles.sectionCopy}>{LANDING_FRAMEWORK_INTRO}</p>
          </div>

          <div className={styles.featureList}>
            {LANDING_AGENT_TEAMS.map((team, index) => (
              <article
                key={team.slug}
                id={team.slug}
                className={`${styles.featureCard} ${team.imageSrc && index % 2 === 1 ? styles.featureCardReverse : ""} ${!team.imageSrc ? styles.featureCardTextOnly : ""}`}
                aria-labelledby={`${team.slug}-heading`}
              >
                {team.imageSrc ? (
                  <div className={styles.featureVisual}>
                    <Image
                      src={team.imageSrc}
                      alt={team.imageAlt ?? ""}
                      width={1280}
                      height={720}
                      className={styles.featureImage}
                    />
                  </div>
                ) : null}
                <div className={styles.featureCopy}>
                  <h3 id={`${team.slug}-heading`} className={styles.featureTitle}>
                    {team.title}
                  </h3>
                  <p className={styles.featureText}>{team.summary}</p>
                  {team.agents && team.agents.length > 0 ? (
                    <ul className={styles.agentList}>
                      {team.agents.map((agent) => (
                        <li key={agent.name} className={styles.agentItem}>
                          <strong className={styles.agentName}>{agent.name}</strong>
                          <span className={styles.agentDescription}>{agent.description}</span>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className={styles.finalCta} aria-labelledby="final-cta-heading">
          <div className={styles.finalCtaInner}>
            <h2 id="final-cta-heading" className={styles.finalCtaTitle}>
              Launch your first multi-agent research run
            </h2>
            <p className={styles.finalCtaCopy}>
              Create a free account, add your provider API key, and watch analyst, researcher,
              trader, and risk agents collaborate on your next ticker. No subscription required
              today.
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
