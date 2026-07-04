/**
 * @file apps/web/src/app/sign-in/layout.tsx
 * Auth route shell for sign-in pages.
 */

import SiteFooter from "@/components/SiteFooter";
import SiteShell, { SiteShellMain } from "@/components/SiteShell";
import styles from "./auth-layout.module.css";

export default function SignInLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <SiteShell>
      <SiteShellMain className={styles.authMain}>{children}</SiteShellMain>
      <SiteFooter />
    </SiteShell>
  );
}
