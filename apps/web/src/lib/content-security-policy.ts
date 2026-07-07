/**
 * @file apps/web/src/lib/content-security-policy.ts
 * Clerk-aware CSP directives merged with app-specific connect-src rules.
 */

const isProd = process.env.NODE_ENV === "production";

function getApiOrigin(): string {
  const raw = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (!raw) {
    return "http://localhost:4000";
  }
  try {
    return new URL(raw).origin;
  } catch {
    return "http://localhost:4000";
  }
}

/** Options passed to clerkMiddleware({ contentSecurityPolicy }). */
export function getClerkContentSecurityPolicyOptions() {
  const connectSrc = [getApiOrigin()];
  if (!isProd) {
    connectSrc.push("ws:", "wss:", "http://localhost:*", "ws://localhost:*");
  }

  return {
    directives: {
      "connect-src": connectSrc,
      // Trade Check PNG export inlines chart canvases as data: URLs via html-to-image.
      "img-src": ["data:", "blob:"],
      "frame-ancestors": ["'none'"],
      "object-src": ["'none'"],
      "base-uri": ["'self'"],
      "form-action": ["'self'"],
    },
  };
}
