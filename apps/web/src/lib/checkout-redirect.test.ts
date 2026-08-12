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
      buildCheckoutSignUpHref("pro", "monthly"),
      "/sign-up?redirect_url=%2Fcheckout%3Fplan%3Dpro%26interval%3Dmonthly",
    );
    assert.equal(
      buildCheckoutSignInHref("standard", "annual"),
      "/sign-in?redirect_url=%2Fcheckout%3Fplan%3Dstandard%26interval%3Dannual",
    );
  });

  it("rejects open redirects", () => {
    assert.equal(
      sanitizeAppRedirectPath("/checkout?plan=pro", "/dashboard"),
      "/checkout?plan=pro",
    );
    assert.equal(sanitizeAppRedirectPath("https://evil.example", "/dashboard"), "/dashboard");
    assert.equal(sanitizeAppRedirectPath("//evil.example", "/dashboard"), "/dashboard");
    assert.equal(sanitizeAppRedirectPath(null, "/dashboard"), "/dashboard");
  });
});
