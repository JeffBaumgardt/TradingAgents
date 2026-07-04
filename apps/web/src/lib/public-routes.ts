/**
 * @file apps/web/src/lib/public-routes.ts
 * Public route patterns for unauthenticated access (middleware + tests).
 */

/** Path prefixes that do not require Clerk authentication. */
export const PUBLIC_ROUTE_PREFIXES = [
  "/",
  "/privacy",
  "/sign-in",
  "/sign-up",
  "/api/webhooks",
] as const;

/** Route matchers for Clerk middleware — `/` must stay exact. */
export const PUBLIC_ROUTE_MATCHERS = [
  "/",
  "/privacy",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/api/webhooks(.*)",
] as const;

/**
 * Returns true when `pathname` is publicly accessible without signing in.
 */
export function isPublicPath(pathname: string): boolean {
  if (pathname === "/") {
    return true;
  }

  return PUBLIC_ROUTE_PREFIXES.some(
    (prefix) => prefix !== "/" && (pathname === prefix || pathname.startsWith(`${prefix}/`)),
  );
}
