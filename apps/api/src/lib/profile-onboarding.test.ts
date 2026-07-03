/**
 * apps/api/src/lib/profile-onboarding.test.ts
 *
 * Verifies profile onboarding eligibility for email vs OAuth users.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { userNeedsProfileOnboarding } from "@tradingagents/utils";

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

  it("skips onboarding for Google OAuth users even without a stored name", () => {
    assert.equal(
      userNeedsProfileOnboarding({
        firstName: null,
        lastName: null,
        externalAccountProviders: ["oauth_google"],
      }),
      false,
    );
  });

  it("skips onboarding for GitHub OAuth users", () => {
    assert.equal(
      userNeedsProfileOnboarding({
        firstName: "",
        lastName: "",
        externalAccountProviders: ["github"],
      }),
      false,
    );
  });
});
