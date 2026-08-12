/**
 * @file apps/web/src/lib/public-routes.test.ts
 */

import { describe, it, expect } from "vitest";
import { isPublicPath, PUBLIC_ROUTE_MATCHERS, PUBLIC_ROUTE_PREFIXES } from "./public-routes";

describe("isPublicPath", () => {
  it("treats the landing page as public", () => {
    expect(isPublicPath("/")).toBe(true);
  });

  it("treats marketing and auth routes as public", () => {
    expect(isPublicPath("/privacy")).toBe(true);
    expect(isPublicPath("/license")).toBe(true);
    expect(isPublicPath("/pricing")).toBe(true);
    expect(isPublicPath("/billing-preview")).toBe(true);
    expect(isPublicPath("/checkout")).toBe(true);
    expect(isPublicPath("/sign-in")).toBe(true);
    expect(isPublicPath("/sign-in/factor-one")).toBe(true);
    expect(isPublicPath("/sign-up")).toBe(true);
    expect(isPublicPath("/sign-up/verify-email")).toBe(true);
    expect(isPublicPath("/api/webhooks/clerk")).toBe(true);
  });

  it("treats shared run links as public", () => {
    expect(isPublicPath("/run")).toBe(true);
    expect(isPublicPath("/run/session-123")).toBe(true);
  });

  it("requires authentication for app routes", () => {
    expect(isPublicPath("/dashboard")).toBe(false);
    expect(isPublicPath("/onboarding")).toBe(false);
    expect(isPublicPath("/settings/billing")).toBe(false);
  });

  it("does not treat other paths as public by prefix accident", () => {
    expect(isPublicPath("/dashboard/sign-in")).toBe(false);
    expect(isPublicPath("/sign-in-attempt")).toBe(false);
    expect(isPublicPath("/runner")).toBe(false);
  });

  it("exports the expected public route prefixes", () => {
    expect(PUBLIC_ROUTE_PREFIXES).toEqual([
      "/",
      "/privacy",
      "/license",
      "/pricing",
      "/billing-preview",
      "/checkout",
      "/sign-in",
      "/sign-up",
      "/run",
      "/api/webhooks",
    ]);
  });

  it("keeps the landing matcher exact for middleware", () => {
    expect(PUBLIC_ROUTE_MATCHERS[0]).toBe("/");
    expect(PUBLIC_ROUTE_MATCHERS.includes("/pricing(/.*)?")).toBeTruthy();
    expect(PUBLIC_ROUTE_MATCHERS.includes("/billing-preview(/.*)?")).toBeTruthy();
    expect(PUBLIC_ROUTE_MATCHERS.includes("/checkout(/.*)?")).toBeTruthy();
    expect(PUBLIC_ROUTE_MATCHERS.includes("/sign-in(.*)")).toBeTruthy();
    expect(PUBLIC_ROUTE_MATCHERS.includes("/run(.*)")).toBeTruthy();
  });
});
