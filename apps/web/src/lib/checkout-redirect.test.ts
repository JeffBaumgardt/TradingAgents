/**
 * @file apps/web/src/lib/checkout-redirect.test.ts
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildCheckoutSignInHref,
  buildCheckoutSignUpHref,
  sanitizeAppRedirectPath,
} from "./checkout-redirect";

describe("checkout-redirect", () => {
  it("builds auth URLs that return to checkout", () => {
    assert.equal(
      buildCheckoutSignUpHref("hosted", "monthly"),
      "/sign-up?redirect_url=%2Fcheckout%3Fplan%3Dhosted%26interval%3Dmonthly",
    );
    assert.equal(
      buildCheckoutSignInHref("byok", "annual"),
      "/sign-in?redirect_url=%2Fcheckout%3Fplan%3Dbyok%26interval%3Dannual",
    );
  });

  it("rejects open redirects", () => {
    assert.equal(sanitizeAppRedirectPath("/checkout?plan=hosted", "/dashboard"), "/checkout?plan=hosted");
    assert.equal(sanitizeAppRedirectPath("https://evil.example", "/dashboard"), "/dashboard");
    assert.equal(sanitizeAppRedirectPath("//evil.example", "/dashboard"), "/dashboard");
    assert.equal(sanitizeAppRedirectPath(null, "/dashboard"), "/dashboard");
  });
});
