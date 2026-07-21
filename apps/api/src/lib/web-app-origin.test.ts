/**
 * apps/api/src/lib/web-app-origin.test.ts
 */

import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { getWebAppOrigin, WebAppOriginError } from "./web-app-origin.js";

const ORIGINAL_ENV = {
  WEB_APP_ORIGIN: process.env.WEB_APP_ORIGIN,
  CORS_ORIGIN: process.env.CORS_ORIGIN,
  NODE_ENV: process.env.NODE_ENV,
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

describe("getWebAppOrigin", () => {
  it("strips a trailing slash and prefers WEB_APP_ORIGIN", () => {
    process.env.WEB_APP_ORIGIN = "https://app.example.com/";
    process.env.CORS_ORIGIN = "https://ignored.example.com";
    assert.equal(getWebAppOrigin(), "https://app.example.com");
  });

  it("rejects credentials embedded in the origin", () => {
    process.env.WEB_APP_ORIGIN = "https://user:pass@app.example.com";
    assert.throws(() => getWebAppOrigin(), WebAppOriginError);
  });

  it("rejects non-https production origins outside localhost", () => {
    process.env.NODE_ENV = "production";
    process.env.WEB_APP_ORIGIN = "http://app.example.com";
    assert.throws(() => getWebAppOrigin(), /https in production/);
  });

  it("allows http localhost in production for local Stripe testing", () => {
    process.env.NODE_ENV = "production";
    process.env.WEB_APP_ORIGIN = "http://localhost:3000";
    assert.equal(getWebAppOrigin(), "http://localhost:3000");
  });
});
