/**
 * @file apps/web/src/lib/checkout-redirect.test.ts
 */

import { describe, it, expect } from "vitest";
import {
  buildCheckoutSignInHref,
  buildCheckoutSignUpHref,
  sanitizeAppRedirectPath,
} from "./checkout-redirect";

describe("checkout-redirect", () => {
  it("builds auth URLs that return to checkout", () => {
    expect(buildCheckoutSignUpHref("pro", "monthly")).toBe("/sign-up?redirect_url=%2Fcheckout%3Fplan%3Dpro%26interval%3Dmonthly");
    expect(buildCheckoutSignInHref("standard", "annual")).toBe("/sign-in?redirect_url=%2Fcheckout%3Fplan%3Dstandard%26interval%3Dannual");
  });

  it("rejects open redirects", () => {
    expect(sanitizeAppRedirectPath("/checkout?plan=pro", "/dashboard")).toBe("/checkout?plan=pro");
    expect(sanitizeAppRedirectPath("https://evil.example", "/dashboard")).toBe("/dashboard");
    expect(sanitizeAppRedirectPath("//evil.example", "/dashboard")).toBe("/dashboard");
    expect(sanitizeAppRedirectPath(null, "/dashboard")).toBe("/dashboard");
  });
});
