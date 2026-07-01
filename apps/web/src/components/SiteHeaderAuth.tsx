/**
 * @file apps/web/src/components/SiteHeaderAuth.tsx
 * Clerk account controls for the site header.
 */

"use client";

import { SignedIn, SignedOut, SignInButton, UserButton } from "@clerk/nextjs";
import { clerkAppearance } from "@/lib/clerk-appearance";
import styles from "./SiteHeader.module.css";

export default function SiteHeaderAuth() {
  return (
    <div className={styles.authControls}>
      <SignedOut>
        <SignInButton mode="modal">
          <button type="button" className={styles.signInButton}>
            Sign in
          </button>
        </SignInButton>
      </SignedOut>
      <SignedIn>
        <UserButton appearance={clerkAppearance} />
      </SignedIn>
    </div>
  );
}
