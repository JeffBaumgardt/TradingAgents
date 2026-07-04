/**
 * @file apps/api/src/middleware/security-headers.test.ts
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createApp } from "../app.js";

describe("security headers middleware", () => {
  it("sets anti-clickjacking and MIME-sniffing headers on responses", async () => {
    const app = createApp();
    const res = await app.request("/health");

    assert.equal(res.headers.get("X-Frame-Options"), "DENY");
    assert.equal(res.headers.get("X-Content-Type-Options"), "nosniff");
    assert.equal(res.headers.get("Referrer-Policy"), "no-referrer");
    assert.equal(res.headers.get("Cross-Origin-Resource-Policy"), "same-origin");
    assert.ok(
      res.headers.get("Permissions-Policy")?.includes("camera=()"),
      "Permissions-Policy should deny camera",
    );
  });
});
