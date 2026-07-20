/**
 * @file apps/web/src/components/SiteFooter.tsx
 * Shared site footer with legal links, feedback, and open-source attribution.
 */

import Link from "next/link";
import FeedbackFooterLink from "@/components/FeedbackFooterLink";
import { UPSTREAM_PROJECT } from "@/lib/license-content";
import styles from "./SiteFooter.module.css";

interface SiteFooterProps {
  disclaimer?: string;
}

export default function SiteFooter({ disclaimer }: SiteFooterProps) {
  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        <div className={styles.meta}>
          {disclaimer ? <p className={styles.disclaimer}>{disclaimer}</p> : null}
          <p className={styles.attribution}>
            Based on{" "}
            <a
              href={UPSTREAM_PROJECT.repositoryUrl}
              className={styles.attributionLink}
              target="_blank"
              rel="noopener noreferrer"
            >
              {UPSTREAM_PROJECT.name}
            </a>{" "}
            by {UPSTREAM_PROJECT.organization}. Licensed under{" "}
            <Link href="/license" className={styles.attributionLink}>
              Apache License 2.0
            </Link>
            .
          </p>
        </div>
        <nav className={styles.nav} aria-label="Legal and feedback">
          <Link href="/pricing" className={styles.link}>
            Pricing
          </Link>
          <Link href="/privacy" className={styles.link}>
            Privacy & cookies
          </Link>
          <Link href="/license" className={styles.link}>
            License
          </Link>
          <FeedbackFooterLink />
        </nav>
      </div>
    </footer>
  );
}
