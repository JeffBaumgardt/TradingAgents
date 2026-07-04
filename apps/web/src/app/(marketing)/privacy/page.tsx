/**
 * @file apps/web/src/app/(marketing)/privacy/page.tsx
 * Placeholder cookie and privacy policy for the marketing site.
 */

import type { Metadata } from "next";
import Link from "next/link";
import styles from "./privacy.module.css";

export const metadata: Metadata = {
  title: "Privacy & cookies — TradingAgents",
  description: "How TradingAgents uses cookies and handles your data on the marketing site.",
};

export default function PrivacyPage() {
  return (
    <main id="main-content" className={styles.page}>
      <Link href="/" className={styles.backLink}>
        ← Back to home
      </Link>
      <h1 className={styles.title}>Cookie and privacy policy</h1>
      <p className={styles.intro}>
        TradingAgents uses essential cookies to keep you signed in and remember basic preferences
        such as cookie acknowledgment and theme selection inside the app.
      </p>
      <section aria-labelledby="cookies-heading">
        <h2 id="cookies-heading" className={styles.sectionTitle}>
          Cookies we use
        </h2>
        <ul className={styles.list}>
          <li>
            <strong>Authentication cookies</strong> — set by Clerk to maintain your signed-in
            session.
          </li>
          <li>
            <strong>tradingagents-cookie-ack</strong> — remembers that you acknowledged cookie use
            on the landing page (1 year, SameSite=Lax).
          </li>
          <li>
            <strong>tradingagents-theme</strong> — stores your in-app theme preference after you sign
            in (local storage, not used on the public landing page).
          </li>
        </ul>
      </section>
      <p className={styles.disclaimer}>
        This page describes the marketing site only. TradingAgents provides AI-generated market
        research for informational purposes. It is not financial, investment, tax, or trading
        advice.
      </p>
    </main>
  );
}
