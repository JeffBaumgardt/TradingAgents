/**
 * apps/api/src/lib/web-app-origin.ts
 *
 * Origin used for Stripe Checkout success/cancel redirects (server-owned).
 */

export function getWebAppOrigin(): string {
  const raw =
    process.env.WEB_APP_ORIGIN?.trim() ||
    process.env.CORS_ORIGIN?.trim() ||
    "http://localhost:3000";
  return raw.replace(/\/$/, "");
}
