/**
 * @file apps/web/src/lib/public-routes-middleware.test.ts
 * Verifies Clerk createRouteMatcher behavior for the landing `/` matcher.
 */

import { describe, it, expect } from "vitest";
import { createRouteMatcher } from "@clerk/nextjs/server";
import { NextRequest } from "next/server";
import { PUBLIC_ROUTE_MATCHERS } from "./public-routes";

const isPublicRoute = createRouteMatcher([...PUBLIC_ROUTE_MATCHERS]);

function createRequest(pathname: string): NextRequest {
  return new NextRequest(new URL(`http://localhost:3000${pathname}`));
}

describe("Clerk public route matcher", () => {
  it("treats only the root landing path as public, not every app route", () => {
    expect(isPublicRoute(createRequest("/"))).toBe(true);
    expect(isPublicRoute(createRequest("/dashboard"))).toBe(false);
    expect(isPublicRoute(createRequest("/settings/billing"))).toBe(false);
  });

  it("treats shared run links as public", () => {
    expect(isPublicRoute(createRequest("/run/session-123"))).toBe(true);
  });

  it("treats marketing, auth, and webhook routes as public", () => {
    expect(isPublicRoute(createRequest("/privacy"))).toBe(true);
    expect(isPublicRoute(createRequest("/license"))).toBe(true);
    expect(isPublicRoute(createRequest("/pricing"))).toBe(true);
    expect(isPublicRoute(createRequest("/billing-preview"))).toBe(true);
    expect(isPublicRoute(createRequest("/checkout"))).toBe(true);
    expect(isPublicRoute(createRequest("/sign-in"))).toBe(true);
    expect(isPublicRoute(createRequest("/sign-in/factor-one"))).toBe(true);
    expect(isPublicRoute(createRequest("/sign-up"))).toBe(true);
    expect(isPublicRoute(createRequest("/api/webhooks/clerk"))).toBe(true);
  });

  it("does not treat sibling pricing/checkout paths as public", () => {
    expect(isPublicRoute(createRequest("/pricing-settings"))).toBe(false);
    expect(isPublicRoute(createRequest("/checkoutfoo"))).toBe(false);
  });
});
