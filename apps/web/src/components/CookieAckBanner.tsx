/**
 * @file apps/web/src/components/CookieAckBanner.tsx
 * Cookie usage acknowledgment banner for the public landing page.
 */

"use client";

import Link from "next/link";
import { useState } from "react";
import { buildCookieAcknowledgmentCookie } from "@/lib/cookie-ack";
import styles from "./CookieAckBanner.module.css";

interface CookieAckBannerProps {
  initialAcknowledged: boolean;
}

export default function CookieAckBanner({ initialAcknowledged }: CookieAckBannerProps) {
  const [acknowledged, setAcknowledged] = useState(initialAcknowledged);

  if (acknowledged) {
    return null;
  }

  function handleAcknowledge() {
    document.cookie = buildCookieAcknowledgmentCookie();
    setAcknowledged(true);
  }

  return (
    <div
      className={styles.banner}
      role="region"
      aria-label="Cookie notice"
      aria-live="polite"
      aria-labelledby="cookie-ack-title"
      aria-describedby="cookie-ack-description"
    >
      <div className={styles.content}>
        <p id="cookie-ack-title" className={styles.title}>
          We use cookies
        </p>
        <p id="cookie-ack-description" className={styles.description}>
          TradingAgents uses essential cookies to keep you signed in and remember your preferences.
          See our{" "}
          <Link href="/privacy" className={styles.policyLink}>
            cookie and privacy policy
          </Link>{" "}
          for details.
        </p>
      </div>
      <button
        type="button"
        className={styles.button}
        onClick={handleAcknowledge}
        aria-label="Acknowledge cookie usage"
      >
        Got it
      </button>
    </div>
  );
}
