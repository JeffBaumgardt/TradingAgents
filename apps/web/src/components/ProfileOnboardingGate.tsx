/**
 * @file apps/web/src/components/ProfileOnboardingGate.tsx
 * Redirects email/password users without a name to profile onboarding.
 */

"use client";

import { useAuth, useUser } from "@clerk/nextjs";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { clerkUserNeedsProfileOnboarding } from "@/lib/profile-onboarding";

const BYPASS_PATH_PREFIXES = ["/sign-in", "/sign-up", "/onboarding", "/api/"];

interface ProfileOnboardingGateProps {
  children: ReactNode;
}

function shouldBypassGate(pathname: string): boolean {
  return BYPASS_PATH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export default function ProfileOnboardingGate({ children }: ProfileOnboardingGateProps) {
  const { isLoaded, isSignedIn } = useAuth();
  const { user } = useUser();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!isLoaded || !isSignedIn || !user || shouldBypassGate(pathname)) {
      return;
    }

    if (clerkUserNeedsProfileOnboarding(user)) {
      router.replace("/onboarding");
    }
  }, [isLoaded, isSignedIn, pathname, router, user]);

  if (!isLoaded) {
    return null;
  }

  if (isSignedIn && user && !shouldBypassGate(pathname) && clerkUserNeedsProfileOnboarding(user)) {
    return null;
  }

  return children;
}
