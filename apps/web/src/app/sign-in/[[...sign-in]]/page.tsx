/**
 * @file apps/web/src/app/sign-in/[[...sign-in]]/page.tsx
 * Clerk sign-in page styled for the active TradingAgents theme.
 */

import { SignIn } from "@clerk/nextjs";
import AuthPageShell from "@/components/AuthPageShell";
import { clerkAppearance } from "@/lib/clerk-appearance";
import { sanitizeAppRedirectPath } from "@/lib/checkout-redirect";
import { LOGGED_IN_HOME_PATH } from "@/lib/landing-redirect";

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const rawRedirect = typeof params.redirect_url === "string" ? params.redirect_url : null;
  const redirectUrl = sanitizeAppRedirectPath(rawRedirect, LOGGED_IN_HOME_PATH);

  return (
    <AuthPageShell
      title="Sign in to TradingAgents"
      subtitle="Access your analysis sessions, billing, and agent reports."
    >
      <SignIn
        appearance={clerkAppearance}
        forceRedirectUrl={redirectUrl}
        fallbackRedirectUrl={redirectUrl}
      />
    </AuthPageShell>
  );
}
