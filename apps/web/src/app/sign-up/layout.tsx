/**
 * @file apps/web/src/app/sign-up/layout.tsx
 * Auth route shell for sign-up pages.
 */

import SiteFooter from "@/components/SiteFooter";
import SiteShell, { SiteShellMain } from "@/components/SiteShell";
import styles from "../sign-in/auth-layout.module.css";

export default function SignUpLayout({
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
