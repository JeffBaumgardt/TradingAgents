/**
 * @file apps/web/src/lib/cookie-ack.ts
 * Cookie consent acknowledgment helpers for the marketing landing page.
 */

export const COOKIE_ACK_NAME = "tradingagents-cookie-ack";
export const COOKIE_ACK_VALUE = "1";
/** One year in seconds. */
export const COOKIE_ACK_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

export interface CookieReader {
  get(name: string): { value: string } | undefined;
}

/**
 * Returns true when the visitor has acknowledged cookie usage on the landing page.
 */
export function hasCookieAcknowledgment(cookies: CookieReader): boolean {
  return cookies.get(COOKIE_ACK_NAME)?.value === COOKIE_ACK_VALUE;
}

/**
 * Builds the Set-Cookie header value for client-side acknowledgment.
 */
export function buildCookieAcknowledgmentCookie(): string {
  const attributes = [
    `${COOKIE_ACK_NAME}=${COOKIE_ACK_VALUE}`,
    "Path=/",
    `Max-Age=${COOKIE_ACK_MAX_AGE_SECONDS}`,
    "SameSite=Lax",
  ];

  if (typeof process !== "undefined" && process.env.NODE_ENV === "production") {
    attributes.push("Secure");
  }

  return attributes.join("; ");
}
