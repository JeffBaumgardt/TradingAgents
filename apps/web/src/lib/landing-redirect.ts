/**
 * @file apps/web/src/lib/landing-redirect.ts
 * Redirect rules for the public marketing landing page.
 */

export const LANDING_PATH = "/";
export const LOGGED_IN_HOME_PATH = "/dashboard";

export interface LandingRedirectInput {
  userId: string | null | undefined;
  pathname: string;
}

/**
 * Signed-in users visiting the marketing landing page should go to the app home.
 */
export function shouldRedirectAuthenticatedUserFromLanding({
  userId,
  pathname,
}: LandingRedirectInput): boolean {
  if (pathname !== LANDING_PATH) {
    return false;
  }

  return Boolean(userId);
}
