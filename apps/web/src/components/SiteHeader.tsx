/**
 * @file apps/web/src/components/SiteHeader.tsx
 * Site header — authenticated app chrome vs guest share-link chrome.
 */

"use client";

import Link from "next/link";
import { useAuth } from "@clerk/nextjs";
import SiteHeaderNav from "@/components/SiteHeaderNav";
import SiteHeaderAuth from "@/components/SiteHeaderAuth";
import ThemePicker from "@/components/ThemePicker";
import styles from "./SiteHeader.module.css";

export default function SiteHeader() {
  const { isLoaded, isSignedIn } = useAuth();

  if (!isLoaded) {
    return (
      <header className={styles.header}>
        <div className={styles.brand}>
          <span className={styles.titleLink}>TradingAgents</span>
          <span className={styles.subtitle}>
            AI-powered multi-agent market analysis
          </span>
        </div>
      </header>
    );
  }

  if (!isSignedIn) {
    return (
      <header className={styles.header}>
        <div className={styles.brand}>
          <Link href="/" className={styles.titleLink} aria-label="TradingAgents home">
            TradingAgents
          </Link>
          <span className={styles.subtitle}>
            AI-powered multi-agent market analysis
          </span>
        </div>
        <nav className={styles.nav} aria-label="Main">
          <Link href="/" className={styles.navLink}>
            Getting started
          </Link>
        </nav>
        <div className={styles.controls}>
          <ThemePicker />
          <SiteHeaderAuth />
        </div>
      </header>
    );
  }

  return (
    <header className={styles.header}>
      <div className={styles.brand}>
        <Link href="/dashboard" className={styles.titleLink}>
          TradingAgents
        </Link>
        <span className={styles.subtitle}>
          AI-powered multi-agent market analysis
        </span>
      </div>
      <SiteHeaderNav />
      <div className={styles.controls}>
        <SiteHeaderAuth />
      </div>
    </header>
  );
}
