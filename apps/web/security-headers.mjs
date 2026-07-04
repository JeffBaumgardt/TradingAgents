/**
 * @file apps/web/security-headers.mjs
 * OWASP-aligned response headers for the Next.js web app (browser-facing HTML).
 */

const isProd = process.env.NODE_ENV === "production";

function getApiOrigin() {
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

function buildContentSecurityPolicy() {
  const apiOrigin = getApiOrigin();
  const connectSrc = [
    "'self'",
    apiOrigin,
    "https://*.clerk.accounts.dev",
    "https://*.clerk.com",
    "https://clerk-telemetry.com",
  ];
  if (!isProd) {
    connectSrc.push("ws:", "wss:", "http://localhost:*", "ws://localhost:*");
  }

  const scriptSrc = [
    "'self'",
    // ThemeScript bootstrap uses inline script; nonce-based CSP is a follow-up.
    "'unsafe-inline'",
    "https://*.clerk.accounts.dev",
    "https://*.clerk.com",
    "https://challenges.cloudflare.com",
  ];
  if (!isProd) {
    scriptSrc.push("'unsafe-eval'");
  }

  const directives = [
    "default-src 'self'",
    `script-src ${scriptSrc.join(" ")}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https://img.clerk.com https://*.clerk.com",
    "font-src 'self' data:",
    `connect-src ${connectSrc.join(" ")}`,
    "frame-src 'self' https://*.clerk.accounts.dev https://*.clerk.com https://challenges.cloudflare.com",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
  ];

  if (isProd) {
    directives.push("upgrade-insecure-requests");
  }

  return directives.join("; ");
}

export function getSecurityHeaders() {
  const headers = [
    { key: "X-Frame-Options", value: "DENY" },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    {
      key: "Permissions-Policy",
      value: "camera=(), microphone=(), geolocation=(), payment=()",
    },
    { key: "Content-Security-Policy", value: buildContentSecurityPolicy() },
  ];

  if (isProd) {
    headers.push({
      key: "Strict-Transport-Security",
      value: "max-age=63072000; includeSubDomains; preload",
    });
  }

  return headers;
}
