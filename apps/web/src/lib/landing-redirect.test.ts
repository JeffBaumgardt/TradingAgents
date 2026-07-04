/**
 * @file apps/web/src/lib/landing-redirect.test.ts
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  LANDING_PATH,
  LOGGED_IN_HOME_PATH,
  shouldRedirectAuthenticatedUserFromLanding,
} from "./landing-redirect";

describe("shouldRedirectAuthenticatedUserFromLanding", () => {
  it("redirects signed-in users away from the landing page", () => {
    assert.equal(
      shouldRedirectAuthenticatedUserFromLanding({
        userId: "user_123",
        pathname: LANDING_PATH,
      }),
      true,
    );
  });

  it("allows signed-out visitors to view the landing page", () => {
    assert.equal(
      shouldRedirectAuthenticatedUserFromLanding({
        userId: null,
        pathname: LANDING_PATH,
      }),
      false,
    );

    assert.equal(
      shouldRedirectAuthenticatedUserFromLanding({
        userId: undefined,
        pathname: LANDING_PATH,
      }),
      false,
    );
  });

  it("does not redirect authenticated users on other routes", () => {
    assert.equal(
      shouldRedirectAuthenticatedUserFromLanding({
        userId: "user_123",
        pathname: LOGGED_IN_HOME_PATH,
      }),
      false,
    );
  });
});

describe("logged-in home path", () => {
  it("uses /dashboard as the authenticated entry point", () => {
    assert.equal(LOGGED_IN_HOME_PATH, "/dashboard");
  });
});
