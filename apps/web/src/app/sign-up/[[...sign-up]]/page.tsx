/**
 * @file apps/web/src/app/sign-up/[[...sign-up]]/page.tsx
 * Clerk sign-up page styled for the active TradingAgents theme.
 */

import { SignUp } from "@clerk/nextjs";
import AuthPageShell from "@/components/AuthPageShell";
import { clerkAppearance } from "@/lib/clerk-appearance";

export default function SignUpPage() {
  return (
    <AuthPageShell
      title="Create your TradingAgents account"
      subtitle="Start configuring multi-agent stock and ETF analysis runs in minutes."
    >
      <SignUp appearance={clerkAppearance} />
    </AuthPageShell>
  );
}
