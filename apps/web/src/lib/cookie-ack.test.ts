/**
 * @file apps/web/src/lib/cookie-ack.test.ts
 */

import { describe, it, expect } from "vitest";
import {
  buildCookieAcknowledgmentCookie,
  COOKIE_ACK_MAX_AGE_SECONDS,
  COOKIE_ACK_NAME,
  COOKIE_ACK_VALUE,
  hasCookieAcknowledgment,
} from "./cookie-ack";

describe("hasCookieAcknowledgment", () => {
  it("returns true when the acknowledgment cookie is present", () => {
    const acknowledged = hasCookieAcknowledgment({
      get: (name) => (name === COOKIE_ACK_NAME ? { value: COOKIE_ACK_VALUE } : undefined),
    });

    expect(acknowledged).toBe(true);
  });

  it("returns false when the cookie is missing or invalid", () => {
    expect(hasCookieAcknowledgment({
        get: () => undefined,
      })).toBe(false);

    expect(hasCookieAcknowledgment({
        get: () => ({ value: "0" }),
      })).toBe(false);
  });
});

describe("buildCookieAcknowledgmentCookie", () => {
  it("sets a one-year SameSite=Lax cookie scoped to the site root", () => {
    const cookie = buildCookieAcknowledgmentCookie();

    expect(cookie).toMatch(new RegExp(`${COOKIE_ACK_NAME}=${COOKIE_ACK_VALUE}`));
    expect(cookie).toMatch(/Path=\//);
    expect(cookie).toMatch(new RegExp(`Max-Age=${COOKIE_ACK_MAX_AGE_SECONDS}`));
    expect(cookie).toMatch(/SameSite=Lax/);
  });
});
