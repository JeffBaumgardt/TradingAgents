/**
 * @file apps/web/src/components/SiteShell.tsx
 * Flex column wrapper that pins the footer to the bottom of the viewport.
 */

import type { ReactNode } from "react";
import styles from "./SiteShell.module.css";

interface SiteShellProps {
  children: ReactNode;
}

export default function SiteShell({ children }: SiteShellProps) {
  return <div className={styles.shell}>{children}</div>;
}

interface SiteShellMainProps {
  children: ReactNode;
  className?: string;
  id?: string;
}

export function SiteShellMain({ children, className, id = "main-content" }: SiteShellMainProps) {
  const classes = className ? `${styles.main} ${className}` : styles.main;
  return (
    <main id={id} className={classes}>
      {children}
    </main>
  );
}
