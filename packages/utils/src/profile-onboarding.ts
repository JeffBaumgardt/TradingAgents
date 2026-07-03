/**
 * @file packages/utils/src/profile-onboarding.ts
 * Determines whether a signed-in user still needs to complete profile onboarding.
 */

export interface ProfileOnboardingInput {
  firstName?: string | null;
  lastName?: string | null;
  /** Clerk external account provider slugs, e.g. google, oauth_google. */
  externalAccountProviders?: string[];
}

const OAUTH_PROVIDER_MARKERS = [
  "google",
  "github",
  "microsoft",
  "apple",
  "facebook",
  "discord",
  "linkedin",
  "oauth_",
] as const;

function hasOAuthProvider(providers: string[]): boolean {
  return providers.some((provider) => {
    const normalized = provider.trim().toLowerCase();
    return OAUTH_PROVIDER_MARKERS.some(
      (marker) => normalized === marker || normalized.startsWith(marker),
    );
  });
}

function hasDisplayName(firstName?: string | null, lastName?: string | null): boolean {
  return Boolean(firstName?.trim() || lastName?.trim());
}

/** Email/password users without a name need onboarding; OAuth users do not. */
export function userNeedsProfileOnboarding(input: ProfileOnboardingInput): boolean {
  if (hasDisplayName(input.firstName, input.lastName)) {
    return false;
  }

  if (hasOAuthProvider(input.externalAccountProviders ?? [])) {
    return false;
  }

  return true;
}
