/**
 * @file apps/web/src/components/SiteHeader.tsx
 * Site header with static branding and client-aware navigation.
 */

import Link from "next/link";
import SiteHeaderNav from "@/components/SiteHeaderNav";
import styles from "./SiteHeader.module.css";

export default function SiteHeader() {
  return (
    <header className={styles.header}>
      <div className={styles.brand}>
        <Link href="/" className={styles.titleLink}>
          TradingAgents
        </Link>
        <span className={styles.subtitle}>
          Multi-Agents LLM Financial Trading Framework
        </span>
      </div>
      <SiteHeaderNav />
    </header>
  );
}
