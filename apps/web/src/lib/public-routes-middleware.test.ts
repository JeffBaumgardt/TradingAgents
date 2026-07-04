/**
 * @file apps/web/src/lib/public-routes-middleware.test.ts
 * Verifies Clerk createRouteMatcher behavior for the landing `/` matcher.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createRouteMatcher } from "@clerk/nextjs/server";
import { NextRequest } from "next/server";
import { PUBLIC_ROUTE_MATCHERS } from "./public-routes";

const isPublicRoute = createRouteMatcher([...PUBLIC_ROUTE_MATCHERS]);

function createRequest(pathname: string): NextRequest {
  return new NextRequest(new URL(`http://localhost:3000${pathname}`));
}

describe("Clerk public route matcher", () => {
  it("treats only the root landing path as public, not every app route", () => {
    assert.equal(isPublicRoute(createRequest("/")), true);
    assert.equal(isPublicRoute(createRequest("/dashboard")), false);
    assert.equal(isPublicRoute(createRequest("/run/session-123")), false);
    assert.equal(isPublicRoute(createRequest("/settings/credentials")), false);
  });

  it("treats marketing, auth, and webhook routes as public", () => {
    assert.equal(isPublicRoute(createRequest("/privacy")), true);
    assert.equal(isPublicRoute(createRequest("/sign-in")), true);
    assert.equal(isPublicRoute(createRequest("/sign-in/factor-one")), true);
    assert.equal(isPublicRoute(createRequest("/sign-up")), true);
    assert.equal(isPublicRoute(createRequest("/api/webhooks/clerk")), true);
  });
});
