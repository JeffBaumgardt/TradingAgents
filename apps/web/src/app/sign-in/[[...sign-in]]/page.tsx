/**
 * @file apps/web/src/app/sign-in/[[...sign-in]]/page.tsx
 * Clerk sign-in page styled for the active TradingAgents theme.
 */

import { SignIn } from "@clerk/nextjs";
import AuthPageShell from "@/components/AuthPageShell";
import { clerkAppearance } from "@/lib/clerk-appearance";

export default function SignInPage() {
  return (
    <AuthPageShell
      title="Sign in to TradingAgents"
      subtitle="Access your analysis sessions, saved settings, and agent reports."
    >
      <SignIn appearance={clerkAppearance} />
    </AuthPageShell>
  );
}
