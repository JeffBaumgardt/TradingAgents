/**
 * @file apps/web/src/components/LandingHeader.tsx
 * Marketing header for the public landing page.
 */

import Link from "next/link";
import styles from "./LandingHeader.module.css";

export default function LandingHeader() {
  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <Link href="/" className={styles.brand} aria-label="TradingAgents home">
          TradingAgents
        </Link>
        <nav className={styles.nav} aria-label="Landing">
          <a href="#framework" className={styles.navLink}>
            Framework
          </a>
          <Link href="/sign-in" className={styles.navLink}>
            Sign in
          </Link>
          <Link href="/sign-up" className={styles.signUpButton}>
            Get started free
          </Link>
        </nav>
      </div>
    </header>
  );
}
