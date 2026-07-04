/**
 * @file apps/web/src/app/sign-up/layout.tsx
 * Auth route shell for sign-up pages.
 */

import SiteFooter from "@/components/SiteFooter";

export default function SignUpLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <>
      <main id="main-content">{children}</main>
      <SiteFooter />
    </>
  );
}
