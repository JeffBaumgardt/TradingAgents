/**
 * @file apps/web/src/lib/landing-redirect.test.ts
 */

import { describe, it, expect } from "vitest";
import {
  LANDING_PATH,
  LOGGED_IN_HOME_PATH,
  shouldRedirectAuthenticatedUserFromLanding,
} from "./landing-redirect";

describe("shouldRedirectAuthenticatedUserFromLanding", () => {
  it("redirects signed-in users away from the landing page", () => {
    expect(shouldRedirectAuthenticatedUserFromLanding({
        userId: "user_123",
        pathname: LANDING_PATH,
      })).toBe(true);
  });

  it("allows signed-out visitors to view the landing page", () => {
    expect(shouldRedirectAuthenticatedUserFromLanding({
        userId: null,
        pathname: LANDING_PATH,
      })).toBe(false);

    expect(shouldRedirectAuthenticatedUserFromLanding({
        userId: undefined,
        pathname: LANDING_PATH,
      })).toBe(false);
  });

  it("does not redirect authenticated users on other routes", () => {
    expect(shouldRedirectAuthenticatedUserFromLanding({
        userId: "user_123",
        pathname: LOGGED_IN_HOME_PATH,
      })).toBe(false);
  });
});

describe("logged-in home path", () => {
  it("uses /dashboard as the authenticated entry point", () => {
    expect(LOGGED_IN_HOME_PATH).toBe("/dashboard");
  });
});
