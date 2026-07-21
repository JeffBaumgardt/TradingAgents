/**
 * apps/api/src/lib/web-app-origin.ts
 *
 * Origin used for Stripe Checkout success/cancel redirects (server-owned).
 */

export class WebAppOriginError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WebAppOriginError";
  }
}

/**
 * Resolve and validate the web app origin for Checkout redirects.
 * Rejects non-http(s) schemes, credentials in the URL, and non-HTTPS
 * production origins (localhost excepted for local Stripe testing).
 */
export function getWebAppOrigin(): string {
  const raw =
    process.env.WEB_APP_ORIGIN?.trim() ||
    process.env.CORS_ORIGIN?.trim() ||
    "http://localhost:3000";

  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new WebAppOriginError(
      `WEB_APP_ORIGIN / CORS_ORIGIN is not a valid URL: ${raw}`,
    );
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new WebAppOriginError(
      `WEB_APP_ORIGIN must use http or https (got ${parsed.protocol})`,
    );
  }

  if (parsed.username || parsed.password) {
    throw new WebAppOriginError(
      "WEB_APP_ORIGIN must not include username or password",
    );
  }

  const host = parsed.hostname.toLowerCase();
  const isLocalhost = host === "localhost" || host === "127.0.0.1";
  if (
    process.env.NODE_ENV === "production" &&
    parsed.protocol !== "https:" &&
    !isLocalhost
  ) {
    throw new WebAppOriginError(
      "WEB_APP_ORIGIN must use https in production (except localhost)",
    );
  }

  return parsed.origin;
}
