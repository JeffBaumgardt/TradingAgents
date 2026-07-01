/**
 * @file apps/web/src/app/sign-in/[[...sign-in]]/page.tsx
 * Clerk sign-in page styled for the TradingAgents dark theme.
 */

import { SignIn } from "@clerk/nextjs";
import { clerkAppearance } from "@/lib/clerk-appearance";

export default function SignInPage() {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        padding: "3rem 1rem",
      }}
    >
      <SignIn appearance={clerkAppearance} />
    </div>
  );
}
