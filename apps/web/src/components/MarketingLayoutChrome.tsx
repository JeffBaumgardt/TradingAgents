/**
 * @file apps/web/src/components/MarketingLayoutChrome.tsx
 * Marketing shell — guest landing chrome vs signed-in app header.
 */

"use client";

import { useEffect, type ReactNode } from "react";
import { useAuth } from "@clerk/nextjs";
import LandingHeader from "@/components/LandingHeader";
import PaperThemeLock from "@/components/PaperThemeLock";
import SiteFooter from "@/components/SiteFooter";
import SiteHeader from "@/components/SiteHeader";
import SiteShell, { SiteShellMain } from "@/components/SiteShell";
import { UserSessionProvider } from "@/context/UserSessionContext";
import { applyThemeToDocument, readStoredThemeId } from "@/lib/theme-store";

interface MarketingLayoutChromeProps {
  children: ReactNode;
}

export default function MarketingLayoutChrome({ children }: MarketingLayoutChromeProps) {
  const { isLoaded, isSignedIn } = useAuth();
  const useAppChrome = !isLoaded || Boolean(isSignedIn);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) {
      return;
    }
    applyThemeToDocument(readStoredThemeId());
  }, [isLoaded, isSignedIn]);

  if (useAppChrome) {
    return (
      <UserSessionProvider>
        <SiteShell>
          <SiteHeader />
          <SiteShellMain>{children}</SiteShellMain>
          <SiteFooter />
        </SiteShell>
      </UserSessionProvider>
    );
  }

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
