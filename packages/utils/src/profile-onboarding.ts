/**
 * @file packages/utils/src/profile-onboarding.ts
 * Determines whether a signed-in user still needs to complete profile onboarding.
 */

export interface ProfileOnboardingInput {
  firstName?: string | null;
  lastName?: string | null;
  /** Clerk external account provider slugs; any linked account skips onboarding. */
  externalAccountProviders?: string[];
}

function hasExternalAccount(providers: string[]): boolean {
  return providers.some((provider) => provider.trim().length > 0);
}

function hasDisplayName(firstName?: string | null, lastName?: string | null): boolean {
  return Boolean(firstName?.trim() || lastName?.trim());
}

/** Email/password users without a name need onboarding; OAuth users do not. */
export function userNeedsProfileOnboarding(input: ProfileOnboardingInput): boolean {
  if (hasDisplayName(input.firstName, input.lastName)) {
    return false;
  }

  if (hasExternalAccount(input.externalAccountProviders ?? [])) {
    return false;
  }

  return true;
}
