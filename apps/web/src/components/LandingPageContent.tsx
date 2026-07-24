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
  LANDING_SUCCESS_STORY,
} from "@/lib/landing-content";
import styles from "./LandingPageContent.module.css";

interface LandingPageContentProps {
  cookieAcknowledged: boolean;
}

export default function LandingPageContent({
  cookieAcknowledged,
}: LandingPageContentProps) {
  return (
    <>
      <div className={styles.page}>
        <section className={styles.hero} aria-labelledby="landing-hero-heading">
          <div className={styles.heroCopy}>
            <p className={styles.eyebrow}>
              TradingAgents Framework · From $3/month
            </p>
            <h1 id="landing-hero-heading" className={styles.heroTitle}>
              {LANDING_HERO.headline}
            </h1>
            <p className={styles.heroIntro}>{LANDING_HERO.copy}</p>
            <div className={styles.heroActions}>
              <Link href="/pricing" className={styles.primaryButton}>
                Get Started
              </Link>
              <Link href="/sign-in" className={styles.secondaryButton}>
                Sign in
              </Link>
            </div>
            <ul
              className={styles.heroHighlights}
              aria-label="Product highlights"
            >
              <li>Subscription required to run research</li>
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

        <section
          id="framework"
          className={styles.features}
          aria-labelledby="framework-heading"
        >
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
                  <h3
                    id={`${team.slug}-heading`}
                    className={styles.featureTitle}
                  >
                    {team.title}
                  </h3>
                  <p className={styles.featureText}>{team.summary}</p>
                  {team.agents && team.agents.length > 0 ? (
                    <ul className={styles.agentList}>
                      {team.agents.map((agent) => (
                        <li key={agent.name} className={styles.agentItem}>
                          <strong className={styles.agentName}>
                            {agent.name}
                          </strong>
                          <span className={styles.agentDescription}>
                            {agent.description}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        </section>

        <section
          className={styles.finalCta}
          aria-labelledby="final-cta-heading"
        >
          <div className={styles.finalCtaInner}>
            <h2 id="final-cta-heading" className={styles.finalCtaTitle}>
              Launch your first multi-agent research run
            </h2>
            <p className={styles.finalCtaCopy}>
              Choose a plan, add your provider API key, and watch analyst,
              researcher, trader, and risk agents collaborate on your next
              ticker. Bring-your-own-key starts at $3/month to help cover
              infrastructure.
            </p>
            <div className={styles.heroActions}>
              <Link href="/pricing" className={styles.primaryButton}>
                Get Started
              </Link>
              <Link href="/sign-up" className={styles.secondaryButton}>
                Create account
              </Link>
            </div>
          </div>
        </section>

        <section
          id="success-story"
          className={styles.successStory}
          aria-labelledby="success-story-heading"
        >
          <div className={styles.successIntro}>
            <p className={styles.successEyebrow}>
              {LANDING_SUCCESS_STORY.eyebrow}
            </p>
            <h2 id="success-story-heading" className={styles.successTitle}>
              {LANDING_SUCCESS_STORY.headline}
            </h2>
            <p className={styles.successIntroCopy}>
              {LANDING_SUCCESS_STORY.intro}
            </p>
            <blockquote className={styles.successQuote}>
              <p>{LANDING_SUCCESS_STORY.quote}</p>
              <footer className={styles.successAttribution}>
                <cite className={styles.successCite}>
                  {LANDING_SUCCESS_STORY.attribution.name}
                </cite>
                <span className={styles.successRole}>
                  {LANDING_SUCCESS_STORY.attribution.role}
                </span>
              </footer>
            </blockquote>
          </div>

          <ol className={styles.storyBeats} aria-label="SPY customer story arc">
            {LANDING_SUCCESS_STORY.beats.map((beat, index) => (
              <li
                key={beat.slug}
                className={`${styles.storyBeat} ${index % 2 === 1 ? styles.storyBeatReverse : ""}`}
              >
                <div className={styles.storyVisual}>
                  <Image
                    src={beat.imageSrc}
                    alt={beat.imageAlt}
                    width={1280}
                    height={720}
                    className={styles.storyImage}
                  />
                </div>
                <div className={styles.storyCopy}>
                  <p className={styles.storyStep}>
                    <span className={styles.storyStepNumber} aria-hidden="true">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <span className={styles.storyStepLabel}>{beat.label}</span>
                  </p>
                  <h3
                    id={`${beat.slug}-heading`}
                    className={styles.storyBeatTitle}
                  >
                    {beat.title}
                  </h3>
                  <p className={styles.storyBeatText}>{beat.copy}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <p className={styles.disclaimer}>{LANDING_DISCLAIMER}</p>
      </div>

      <CookieAckBanner initialAcknowledged={cookieAcknowledged} />
    </>
  );
}
