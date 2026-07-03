/**
 * @file apps/web/src/lib/profile-onboarding.ts
 * Maps Clerk user records to shared onboarding eligibility checks.
 */

import { userNeedsProfileOnboarding } from "@tradingagents/utils";

interface ClerkProfileUser {
  firstName: string | null;
  lastName: string | null;
  externalAccounts: Array<{ provider: string }>;
}

export function clerkUserNeedsProfileOnboarding(user: ClerkProfileUser): boolean {
  return userNeedsProfileOnboarding({
    firstName: user.firstName,
    lastName: user.lastName,
    externalAccountProviders: user.externalAccounts.map((account) => account.provider),
  });
}

export { userNeedsProfileOnboarding };
