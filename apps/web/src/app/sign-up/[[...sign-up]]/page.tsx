/**
 * @file apps/web/src/app/sign-up/[[...sign-up]]/page.tsx
 * Clerk sign-up page styled for the active TradingAgents theme.
 */

import { SignUp } from "@clerk/nextjs";
import AuthPageShell from "@/components/AuthPageShell";
import { clerkAppearance } from "@/lib/clerk-appearance";
import { sanitizeAppRedirectPath } from "@/lib/checkout-redirect";
import { LOGGED_IN_HOME_PATH } from "@/lib/landing-redirect";

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const rawRedirect = typeof params.redirect_url === "string" ? params.redirect_url : null;
  const redirectUrl = sanitizeAppRedirectPath(rawRedirect, LOGGED_IN_HOME_PATH);

  return (
    <AuthPageShell
      title="Create your TradingAgents account"
      subtitle="Create your account first — you’ll finish plan payment on the next step."
    >
      <SignUp
        appearance={clerkAppearance}
        forceRedirectUrl={redirectUrl}
        fallbackRedirectUrl={redirectUrl}
      />
    </AuthPageShell>
  );
}
