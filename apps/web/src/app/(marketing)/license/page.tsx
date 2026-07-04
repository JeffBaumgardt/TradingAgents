/**
 * @file apps/web/src/app/(marketing)/license/page.tsx
 * Open-source license and upstream attribution for the public marketing site.
 */

import type { Metadata } from "next";
import Link from "next/link";
import {
  LICENSE_PAGE_LAST_UPDATED,
  LICENSE_SECTIONS,
  UPSTREAM_PROJECT,
} from "@/lib/license-content";
import styles from "../privacy/privacy.module.css";

export const metadata: Metadata = {
  title: "License — TradingAgents",
  description:
    "Apache License 2.0 disclosure and upstream attribution for TradingAgents.",
};

export default function LicensePage() {
  return (
    <div className={styles.page}>
      <Link href="/" className={styles.backLink}>
        ← Back to home
      </Link>

      <header className={styles.header}>
        <h1 className={styles.title}>Open-source license</h1>
        <p className={styles.updated}>Last updated: {LICENSE_PAGE_LAST_UPDATED}</p>
        <p className={styles.intro}>
          TradingAgents is licensed under the{" "}
          <a
            href={UPSTREAM_PROJECT.licenseUrl}
            className={styles.link}
            target="_blank"
            rel="noopener noreferrer"
          >
            {UPSTREAM_PROJECT.licenseName}
          </a>
          . This page summarizes your rights and our upstream attribution obligations.
        </p>
      </header>

      <div className={styles.sections}>
        {LICENSE_SECTIONS.map((section) => (
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
        <h2 className={styles.contactTitle}>Upstream project</h2>
        <p className={styles.paragraph}>
          Framework by{" "}
          <a
            href={UPSTREAM_PROJECT.repositoryUrl}
            className={styles.link}
            target="_blank"
            rel="noopener noreferrer"
          >
            {UPSTREAM_PROJECT.organization} / {UPSTREAM_PROJECT.name}
          </a>
        </p>
      </footer>
    </div>
  );
}
