/**
 * @file apps/web/src/app/(marketing)/layout.tsx
 * Marketing layout — paper theme only, no app chrome or user settings.
 */

import LandingHeader from "@/components/LandingHeader";
import PaperThemeLock from "@/components/PaperThemeLock";
import styles from "./marketing.module.css";

export default function MarketingLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <PaperThemeLock>
      <LandingHeader />
      <main id="main-content" className={styles.main}>
        {children}
      </main>
    </PaperThemeLock>
  );
}
