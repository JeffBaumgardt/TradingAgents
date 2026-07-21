/**
 * apps/api/src/lib/stripe-prices.test.ts
 */

import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import {
  areStripePricesConfigured,
  getStripePriceId,
  missingStripePriceEnvKeys,
} from "./stripe-prices.js";

const KEYS = [
  "STRIPE_PRICE_BYOK_MONTHLY",
  "STRIPE_PRICE_BYOK_ANNUAL",
  "STRIPE_PRICE_HOSTED_MONTHLY",
  "STRIPE_PRICE_HOSTED_ANNUAL",
] as const;

const previous = new Map<string, string | undefined>();

function setPrices(values: Partial<Record<(typeof KEYS)[number], string>>) {
  for (const key of KEYS) {
    previous.set(key, process.env[key]);
    const next = values[key];
    if (next == null) {
      delete process.env[key];
    } else {
      process.env[key] = next;
    }
  }
}

afterEach(() => {
  for (const key of KEYS) {
    const value = previous.get(key);
    if (value == null) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
  previous.clear();
});

describe("stripe-prices", () => {
  it("resolves price ids from env", () => {
    setPrices({
      STRIPE_PRICE_BYOK_MONTHLY: "price_byok_m",
      STRIPE_PRICE_BYOK_ANNUAL: "price_byok_a",
      STRIPE_PRICE_HOSTED_MONTHLY: "price_hosted_m",
      STRIPE_PRICE_HOSTED_ANNUAL: "price_hosted_a",
    });

    assert.equal(getStripePriceId("byok", "monthly"), "price_byok_m");
    assert.equal(getStripePriceId("hosted", "annual"), "price_hosted_a");
    assert.equal(areStripePricesConfigured(), true);
    assert.deepEqual(missingStripePriceEnvKeys(), []);
  });

  it("reports missing price env keys", () => {
    setPrices({});
    assert.equal(areStripePricesConfigured(), false);
    assert.ok(missingStripePriceEnvKeys().includes("STRIPE_PRICE_BYOK_MONTHLY"));
  });
});
