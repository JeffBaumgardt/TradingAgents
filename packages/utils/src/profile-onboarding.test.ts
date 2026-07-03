/**
 * @file packages/utils/src/profile-onboarding.test.ts
 *
 * Verifies profile onboarding eligibility for email vs OAuth users.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { userNeedsProfileOnboarding } from "./profile-onboarding.js";

describe("userNeedsProfileOnboarding", () => {
  it("requires onboarding for email users without a name", () => {
    assert.equal(
      userNeedsProfileOnboarding({
        firstName: null,
        lastName: null,
        externalAccountProviders: [],
      }),
      true,
    );
  });

  it("skips onboarding when a first name is present", () => {
    assert.equal(
      userNeedsProfileOnboarding({
        firstName: "Ada",
        lastName: null,
        externalAccountProviders: [],
      }),
      false,
    );
  });

  it("skips onboarding when a last name is present", () => {
    assert.equal(
      userNeedsProfileOnboarding({
        firstName: null,
        lastName: "Lovelace",
        externalAccountProviders: [],
      }),
      false,
    );
  });

  it("skips onboarding for users with any linked external account", () => {
    assert.equal(
      userNeedsProfileOnboarding({
        firstName: null,
        lastName: null,
        externalAccountProviders: ["oauth_google"],
      }),
      false,
    );
  });

  it("skips onboarding for custom OIDC providers", () => {
    assert.equal(
      userNeedsProfileOnboarding({
        firstName: "",
        lastName: "",
        externalAccountProviders: ["oauth_custom_acme"],
      }),
      false,
    );
  });
});
