/**
 * apps/api/src/lib/billing-scaffold.test.ts
 */

import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { isBillingScaffoldEnabled } from "./billing-scaffold.js";

const ORIGINAL_ENV = {
  NODE_ENV: process.env.NODE_ENV,
  BILLING_SCAFFOLD: process.env.BILLING_SCAFFOLD,
};

afterEach(() => {
  for (const [key, value] of Object.entries(ORIGINAL_ENV)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
});

describe("isBillingScaffoldEnabled", () => {
  it("is disabled in production even when BILLING_SCAFFOLD=true", () => {
    process.env.NODE_ENV = "production";
    process.env.BILLING_SCAFFOLD = "true";
    assert.equal(isBillingScaffoldEnabled(), false);
  });

  it("requires an explicit BILLING_SCAFFOLD=true outside production", () => {
    process.env.NODE_ENV = "test";
    delete process.env.BILLING_SCAFFOLD;
    assert.equal(isBillingScaffoldEnabled(), false);

    process.env.BILLING_SCAFFOLD = "true";
    assert.equal(isBillingScaffoldEnabled(), true);
  });
});
