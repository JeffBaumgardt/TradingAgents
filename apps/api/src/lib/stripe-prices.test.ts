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
  "STRIPE_PRICE_STANDARD_MONTHLY",
  "STRIPE_PRICE_STANDARD_ANNUAL",
  "STRIPE_PRICE_PRO_MONTHLY",
  "STRIPE_PRICE_PRO_ANNUAL",
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
      STRIPE_PRICE_STANDARD_MONTHLY: "price_standard_m",
      STRIPE_PRICE_STANDARD_ANNUAL: "price_standard_a",
      STRIPE_PRICE_PRO_MONTHLY: "price_pro_m",
      STRIPE_PRICE_PRO_ANNUAL: "price_pro_a",
    });

    assert.equal(getStripePriceId("standard", "monthly"), "price_standard_m");
    assert.equal(getStripePriceId("pro", "annual"), "price_pro_a");
    assert.equal(areStripePricesConfigured(), true);
    assert.deepEqual(missingStripePriceEnvKeys(), []);
  });

  it("reports missing price env keys", () => {
    setPrices({});
    assert.equal(areStripePricesConfigured(), false);
    assert.ok(missingStripePriceEnvKeys().includes("STRIPE_PRICE_STANDARD_MONTHLY"));
  });
});
