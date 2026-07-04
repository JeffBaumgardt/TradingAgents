/**
 * @file apps/web/src/lib/cookie-ack.test.ts
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
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

    assert.equal(acknowledged, true);
  });

  it("returns false when the cookie is missing or invalid", () => {
    assert.equal(
      hasCookieAcknowledgment({
        get: () => undefined,
      }),
      false,
    );

    assert.equal(
      hasCookieAcknowledgment({
        get: () => ({ value: "0" }),
      }),
      false,
    );
  });
});

describe("buildCookieAcknowledgmentCookie", () => {
  it("sets a one-year SameSite=Lax cookie scoped to the site root", () => {
    const cookie = buildCookieAcknowledgmentCookie();

    assert.match(cookie, new RegExp(`${COOKIE_ACK_NAME}=${COOKIE_ACK_VALUE}`));
    assert.match(cookie, /Path=\//);
    assert.match(cookie, new RegExp(`Max-Age=${COOKIE_ACK_MAX_AGE_SECONDS}`));
    assert.match(cookie, /SameSite=Lax/);
  });
});
