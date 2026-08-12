/**
 * @file apps/web/src/lib/content-security-policy.test.ts
 */

import { describe, it, expect } from "vitest";
import { getClerkContentSecurityPolicyOptions } from "./content-security-policy.js";

describe("getClerkContentSecurityPolicyOptions", () => {
  it("includes API origin and frame-ancestors in directives", () => {
    const options = getClerkContentSecurityPolicyOptions();
    expect(options.directives).toBeTruthy();
    expect(options.directives["connect-src"]?.includes("http://localhost:4000")).toBeTruthy();
    expect(options.directives["img-src"]).toEqual(["data:", "blob:"]);
    expect(options.directives["frame-ancestors"]).toEqual(["'none'"]);
    expect(options.directives["object-src"]).toEqual(["'none'"]);
  });
});
