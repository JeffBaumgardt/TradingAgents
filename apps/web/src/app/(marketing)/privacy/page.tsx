/**
 * @file apps/web/src/app/(marketing)/privacy/page.tsx
 * Privacy and cookie policy for the public marketing site.
 */

import type { Metadata } from "next";
import Link from "next/link";
import {
  PRIVACY_CONTACT,
  PRIVACY_POLICY_LAST_UPDATED,
  PRIVACY_POLICY_SECTIONS,
} from "@/lib/privacy-policy-content";
import styles from "./privacy.module.css";

export const metadata: Metadata = {
  title: "Privacy & cookies — TradingAgents",
  description:
    "Privacy and cookie policy for TradingAgents — what we collect, why, and your rights.",
};

export default function PrivacyPage() {
  return (
    <main id="main-content" className={styles.page}>
      <Link href="/" className={styles.backLink}>
        ← Back to home
      </Link>

      <header className={styles.header}>
        <h1 className={styles.title}>Privacy and cookie policy</h1>
        <p className={styles.updated}>Last updated: {PRIVACY_POLICY_LAST_UPDATED}</p>
        <p className={styles.intro}>
          This policy describes how TradingAgents handles personal data, cookies, and browser
          storage when you use our website and signed-in application.
        </p>
      </header>

      <div className={styles.sections}>
        {PRIVACY_POLICY_SECTIONS.map((section) => (
          <section
            key={section.id}
            id={section.id}
            className={styles.section}
            aria-labelledby={`${section.id}-heading`}
          >
            <h2 id={`${section.id}-heading`} className={styles.sectionTitle}>
              {section.title}
            </h2>

            {section.paragraphs?.map((paragraph) => (
              <p key={paragraph} className={styles.paragraph}>
                {paragraph}
              </p>
            ))}

            {section.items ? (
              <dl className={styles.definitionList}>
                {section.items.map((item) => (
                  <div key={item.title} className={styles.definitionItem}>
                    <dt className={styles.definitionTerm}>{item.title}</dt>
                    <dd className={styles.definitionDescription}>{item.description}</dd>
                  </div>
                ))}
              </dl>
            ) : null}

            {section.bullets ? (
              <ul className={styles.list}>
                {section.bullets.map((bullet) => (
                  <li key={bullet}>{bullet}</li>
                ))}
              </ul>
            ) : null}
          </section>
        ))}
      </div>

      <footer className={styles.contact}>
        <h2 className={styles.contactTitle}>Contact</h2>
        <p className={styles.paragraph}>
          Privacy questions or requests:{" "}
          <a href={PRIVACY_CONTACT.href} className={styles.link}>
            {PRIVACY_CONTACT.label}
          </a>
        </p>
      </footer>
    </main>
  );
}
