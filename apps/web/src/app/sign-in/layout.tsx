/**
 * @file apps/web/src/app/sign-in/layout.tsx
 * Auth route shell for sign-in pages.
 */

import SiteFooter from "@/components/SiteFooter";

export default function SignInLayout({
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
