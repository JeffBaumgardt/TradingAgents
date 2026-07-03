/**
 * @file apps/web/src/components/AuthPageShell.tsx
 * Branded layout wrapper for Clerk authentication pages.
 */

import type { ReactNode } from "react";
import styles from "./AuthPageShell.module.css";

interface AuthPageShellProps {
  title: string;
  subtitle: string;
  children: ReactNode;
}

export default function AuthPageShell({ title, subtitle, children }: AuthPageShellProps) {
  return (
    <section
      className={styles.shell}
      aria-labelledby="auth-page-title"
      aria-describedby="auth-page-subtitle"
    >
      <header className={styles.brand}>
        <h1 id="auth-page-title" className={styles.title}>
          {title}
        </h1>
        <p id="auth-page-subtitle" className={styles.subtitle}>
          {subtitle}
        </p>
      </header>
      <div className={styles.clerkHost}>{children}</div>
    </section>
  );
}
