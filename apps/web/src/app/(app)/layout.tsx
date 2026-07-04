/**
 * @file apps/web/src/app/(app)/layout.tsx
 * Authenticated app shell with header, onboarding gate, and session state.
 */

import SiteHeader from "@/components/SiteHeader";
import ProfileOnboardingGate from "@/components/ProfileOnboardingGate";
import { UserSessionProvider } from "@/context/UserSessionContext";

export default function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <UserSessionProvider>
      <ProfileOnboardingGate>
        <SiteHeader />
        <main id="main-content">{children}</main>
      </ProfileOnboardingGate>
    </UserSessionProvider>
  );
}
