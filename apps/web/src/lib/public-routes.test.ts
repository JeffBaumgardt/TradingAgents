/**
 * @file apps/web/src/lib/public-routes.test.ts
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isPublicPath, PUBLIC_ROUTE_MATCHERS, PUBLIC_ROUTE_PREFIXES } from "./public-routes";

describe("isPublicPath", () => {
  it("treats the landing page as public", () => {
    assert.equal(isPublicPath("/"), true);
  });

  it("treats marketing and auth routes as public", () => {
    assert.equal(isPublicPath("/privacy"), true);
    assert.equal(isPublicPath("/license"), true);
    assert.equal(isPublicPath("/sign-in"), true);
    assert.equal(isPublicPath("/sign-in/factor-one"), true);
    assert.equal(isPublicPath("/sign-up"), true);
    assert.equal(isPublicPath("/sign-up/verify-email"), true);
    assert.equal(isPublicPath("/api/webhooks/clerk"), true);
  });

  it("treats shared run links as public", () => {
    assert.equal(isPublicPath("/run"), true);
    assert.equal(isPublicPath("/run/session-123"), true);
  });

  it("requires authentication for app routes", () => {
    assert.equal(isPublicPath("/dashboard"), false);
    assert.equal(isPublicPath("/onboarding"), false);
    assert.equal(isPublicPath("/settings/credentials"), false);
  });

  it("does not treat other paths as public by prefix accident", () => {
    assert.equal(isPublicPath("/dashboard/sign-in"), false);
    assert.equal(isPublicPath("/sign-in-attempt"), false);
    assert.equal(isPublicPath("/runner"), false);
  });

  it("exports the expected public route prefixes", () => {
    assert.deepEqual(PUBLIC_ROUTE_PREFIXES, [
      "/",
      "/privacy",
      "/license",
      "/sign-in",
      "/sign-up",
      "/run",
      "/api/webhooks",
    ]);
  });

  it("keeps the landing matcher exact for middleware", () => {
    assert.equal(PUBLIC_ROUTE_MATCHERS[0], "/");
    assert.ok(PUBLIC_ROUTE_MATCHERS.includes("/sign-in(.*)"));
    assert.ok(PUBLIC_ROUTE_MATCHERS.includes("/run(.*)"));
  });
});
