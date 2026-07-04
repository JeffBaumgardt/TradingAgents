/**
 * @file apps/api/src/middleware/security-headers.ts
 * OWASP-aligned response headers for the JSON/SSE API gateway.
 */

import { secureHeaders } from "hono/secure-headers";

const isProd = process.env.NODE_ENV === "production";

export function securityHeadersMiddleware() {
  return secureHeaders({
    xFrameOptions: "DENY",
    xContentTypeOptions: "nosniff",
    referrerPolicy: "no-referrer",
    strictTransportSecurity: isProd
      ? "max-age=63072000; includeSubDomains; preload"
      : false,
    permissionsPolicy: {
      camera: [],
      microphone: [],
      geolocation: [],
      payment: [],
    },
    crossOriginResourcePolicy: "same-origin",
    removePoweredBy: true,
  });
}
