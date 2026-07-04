/**
 * @file apps/web/src/middleware.ts
 * Protect app routes with Clerk; keep sign-in and webhook paths public.
 * CSP is injected here via Clerk so FAPI hosts and clerk.browser.js load correctly.
 */

import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { getClerkContentSecurityPolicyOptions } from "@/lib/content-security-policy";

const isPublicRoute = createRouteMatcher([
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/api/webhooks(.*)",
]);

export default clerkMiddleware(
  async (auth, request) => {
    if (!isPublicRoute(request)) {
      await auth.protect();
    }
  },
  {
    contentSecurityPolicy: getClerkContentSecurityPolicyOptions(),
  },
);

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
    "/__clerk/(.*)",
  ],
};
