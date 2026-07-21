/**
 * @file apps/web/src/components/SiteHeaderAuth.tsx
 * Clerk account controls — billing, API keys, and theme live in the UserButton menu.
 */

"use client";

import { SignedIn, SignedOut, SignInButton, UserButton } from "@clerk/nextjs";
import ThemePicker from "@/components/ThemePicker";
import { clerkAppearance } from "@/lib/clerk-appearance";
import styles from "./SiteHeader.module.css";
import themeStyles from "./ThemePicker.module.css";

function MenuIcon({ path }: { path: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 16 16"
      fill="currentColor"
      width="1em"
      height="1em"
      aria-hidden="true"
    >
      <path d={path} />
    </svg>
  );
}

const billingIcon = (
  <MenuIcon path="M1 4.25A2.25 2.25 0 0 1 3.25 2h9.5A2.25 2.25 0 0 1 15 4.25v7.5A2.25 2.25 0 0 1 12.75 14h-9.5A2.25 2.25 0 0 1 1 11.75v-7.5Zm2.25-.75a.75.75 0 0 0-.75.75V6h11V4.25a.75.75 0 0 0-.75-.75h-9.5ZM14 7.5H2v4.25c0 .414.336.75.75.75h9.5a.75.75 0 0 0 .75-.75V7.5Z" />
);

const keysIcon = (
  <MenuIcon path="M4.5 7a3.5 3.5 0 1 1 6.79 1.152l3.279 3.278a.75.75 0 1 1-1.06 1.06l-.722-.721v1.481a.75.75 0 0 1-1.5 0v-1.48l-.722-.722a.75.75 0 0 1 1.061-1.06l.943.942A3.5 3.5 0 0 1 4.5 7Zm3.5-2a2 2 0 1 0 0 4 2 2 0 0 0 0-4Z" />
);

const appearanceIcon = (
  <MenuIcon path="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1ZM2.05 8a5.95 5.95 0 0 1 5.2-5.9v11.8A5.95 5.95 0 0 1 2.05 8Z" />
);

function AppearancePreferences() {
  return (
    <div className={themeStyles.panel}>
      <h1 className={themeStyles.panelTitle}>Appearance</h1>
      <p className={themeStyles.panelCopy}>
        Choose how TradingAgents looks across the app. Your preference is saved in this browser.
      </p>
      <ThemePicker variant="panel" />
    </div>
  );
}

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
        <UserButton appearance={clerkAppearance}>
          <UserButton.MenuItems>
            <UserButton.Link label="Billing" labelIcon={billingIcon} href="/settings/billing" />
            <UserButton.Link label="API keys" labelIcon={keysIcon} href="/settings/credentials" />
            <UserButton.Action label="Appearance" labelIcon={appearanceIcon} open="appearance" />
          </UserButton.MenuItems>
          <UserButton.UserProfilePage
            label="Appearance"
            labelIcon={appearanceIcon}
            url="appearance"
          >
            <AppearancePreferences />
          </UserButton.UserProfilePage>
        </UserButton>
      </SignedIn>
    </div>
  );
}
