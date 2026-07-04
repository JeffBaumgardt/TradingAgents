/**
 * @file apps/web/src/components/SiteHeaderNav.tsx
 * Client nav links that depend on credential session state.
 */

"use client";

import Link from "next/link";
import { useUserSession } from "@/context/UserSessionContext";
import styles from "./SiteHeader.module.css";

export default function SiteHeaderNav() {
  const { credentialsReady } = useUserSession();

  return (
    <nav className={styles.nav} aria-label="Main">
      {credentialsReady ? (
        <Link href="/dashboard" className={styles.navLink}>
          Start analysis
        </Link>
      ) : null}
      <Link href="/settings/credentials" className={styles.navLink}>
        API keys
      </Link>
    </nav>
  );
}
