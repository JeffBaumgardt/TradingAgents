/**
 * @file apps/web/src/lib/content-security-policy.test.ts
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getClerkContentSecurityPolicyOptions } from "./content-security-policy.js";

describe("getClerkContentSecurityPolicyOptions", () => {
  it("includes API origin and frame-ancestors in directives", () => {
    const options = getClerkContentSecurityPolicyOptions();
    assert.ok(options.directives);
    assert.ok(options.directives["connect-src"]?.includes("http://localhost:4000"));
    assert.deepEqual(options.directives["frame-ancestors"], ["'none'"]);
    assert.deepEqual(options.directives["object-src"], ["'none'"]);
  });
});
