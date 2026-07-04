/**
 * @file apps/web/src/components/ProfileOnboardingPageContent.tsx
 * Client shell for the profile onboarding page.
 */

"use client";

import { useAuth, useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import ProfileOnboardingForm from "@/components/ProfileOnboardingForm";
import { clerkUserNeedsProfileOnboarding } from "@/lib/profile-onboarding";

export default function ProfileOnboardingPageContent() {
  const { isLoaded, isSignedIn } = useAuth();
  const { user } = useUser();
  const router = useRouter();

  useEffect(() => {
    if (!isLoaded || !isSignedIn || !user) {
      return;
    }

    if (!clerkUserNeedsProfileOnboarding(user)) {
      router.replace("/dashboard");
    }
  }, [isLoaded, isSignedIn, router, user]);

  if (!isLoaded) {
    return <p className="muted">Loading…</p>;
  }

  if (!isSignedIn || !user) {
    return <p className="muted">Redirecting to sign in…</p>;
  }

  if (!clerkUserNeedsProfileOnboarding(user)) {
    return null;
  }

  return (
    <>
      <h1 style={{ marginBottom: "0.25rem" }}>Welcome to TradingAgents</h1>
      <p className="muted" style={{ marginTop: 0, marginBottom: "1.5rem" }}>
        Tell us your name so we can personalize your workspace.
      </p>
      <ProfileOnboardingForm />
    </>
  );
}
