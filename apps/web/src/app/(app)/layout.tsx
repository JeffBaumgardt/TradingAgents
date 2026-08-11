/**
 * @file apps/web/src/app/(app)/layout.tsx
 * Authenticated app shell with subscription / trial access control.
 */

import { Suspense } from "react";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import SiteShell, { SiteShellMain } from "@/components/SiteShell";
import SubscriptionGate from "@/components/SubscriptionGate";
import HomePageSkeleton from "@/components/HomePageSkeleton";

export default function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <SiteShell>
      <SiteHeader />
      <SiteShellMain>
        <Suspense fallback={<HomePageSkeleton />}>
          <SubscriptionGate>{children}</SubscriptionGate>
        </Suspense>
      </SiteShellMain>
      <SiteFooter />
    </SiteShell>
  );
}
