/**
 * @file apps/web/src/components/SiteFooter.tsx
 * Shared site footer with legal links.
 */

import Link from "next/link";
import styles from "./SiteFooter.module.css";

interface SiteFooterProps {
  disclaimer?: string;
}

export default function SiteFooter({ disclaimer }: SiteFooterProps) {
  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        {disclaimer ? <p className={styles.disclaimer}>{disclaimer}</p> : null}
        <nav className={styles.nav} aria-label="Legal">
          <Link href="/privacy" className={styles.link}>
            Privacy & cookies
          </Link>
        </nav>
      </div>
    </footer>
  );
}
