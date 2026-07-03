/**
 * @file apps/web/src/app/onboarding/page.tsx
 * Profile onboarding for email/password users without a display name.
 */

import ProfileOnboardingForm from "@/components/ProfileOnboardingForm";

export default function OnboardingPage() {
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
