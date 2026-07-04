/**
 * @file apps/web/security-headers.mjs
 * OWASP-aligned response headers for the Next.js web app (browser-facing HTML).
 *
 * CSP is injected by clerkMiddleware (see src/middleware.ts) so Clerk FAPI hosts,
 * worker-src, and clerk.browser.js are allowed automatically.
 */

const isProd = process.env.NODE_ENV === "production";

export function getSecurityHeaders() {
  const headers = [
    { key: "X-Frame-Options", value: "DENY" },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    {
      key: "Permissions-Policy",
      value: "camera=(), microphone=(), geolocation=(), payment=()",
    },
  ];

  if (isProd) {
    headers.push({
      key: "Strict-Transport-Security",
      value: "max-age=63072000; includeSubDomains; preload",
    });
  }

  return headers;
}
