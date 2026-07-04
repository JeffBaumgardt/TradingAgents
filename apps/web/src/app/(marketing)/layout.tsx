/**
 * @file apps/web/src/app/(marketing)/layout.tsx
 * Marketing layout — paper theme only, no app chrome or user settings.
 */

import LandingHeader from "@/components/LandingHeader";
import PaperThemeLock from "@/components/PaperThemeLock";
import SiteFooter from "@/components/SiteFooter";
import SiteShell, { SiteShellMain } from "@/components/SiteShell";

export default function MarketingLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <PaperThemeLock>
      <SiteShell>
        <LandingHeader />
        <SiteShellMain>{children}</SiteShellMain>
        <SiteFooter />
      </SiteShell>
    </PaperThemeLock>
  );
}
