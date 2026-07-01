/**
 * @file apps/web/src/app/sign-up/[[...sign-up]]/page.tsx
 * Clerk sign-up page styled for the TradingAgents dark theme.
 */

import { SignUp } from "@clerk/nextjs";
import { clerkAppearance } from "@/lib/clerk-appearance";

export default function SignUpPage() {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        padding: "3rem 1rem",
      }}
    >
      <SignUp appearance={clerkAppearance} />
    </div>
  );
}
