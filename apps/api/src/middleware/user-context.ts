/**
 * apps/api/src/middleware/user-context.ts
 *
 * Resolves the caller from a verified Clerk session token (Authorization header).
 * The web app obtains the token via Clerk's getToken(); cookies are not sent
 * cross-origin to the API on a separate port.
 */

import { verifyToken } from "@clerk/backend";
import {
  TokenVerificationError,
  TokenVerificationErrorReason,
} from "@clerk/backend/errors";
import type { Context, Next } from "hono";
import {
  extractBearerToken,
  getClerkAuthorizedParties,
} from "../clerk-client.js";

async function verifySessionToken(token: string) {
  const verifyOptions: Parameters<typeof verifyToken>[1] = {
    secretKey: process.env.CLERK_SECRET_KEY,
    authorizedParties: getClerkAuthorizedParties(),
  };

  if (process.env.CLERK_JWT_KEY) {
    verifyOptions.jwtKey = process.env.CLERK_JWT_KEY;
  }

  try {
    return await verifyToken(token, verifyOptions);
  } catch (error) {
    if (
      process.env.NODE_ENV !== "production" &&
      error instanceof TokenVerificationError &&
      error.reason === TokenVerificationErrorReason.TokenInvalidAuthorizedParties
    ) {
      console.warn(
        "Clerk token azp did not match authorized parties",
        verifyOptions.authorizedParties,
        "- retrying without authorizedParties in development",
      );
      const { authorizedParties: _ignored, ...withoutParties } = verifyOptions;
      return verifyToken(token, withoutParties);
    }
    throw error;
  }
}

export function requireUserId() {
  return async (c: Context, next: Next) => {
    const token = extractBearerToken(c.req.header("Authorization"));
    if (!token) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    try {
      const payload = await verifySessionToken(token);
      const userId = payload.sub;
      if (!userId) {
        return c.json({ error: "Unauthorized" }, 401);
      }

      c.set("userId", userId);
      await next();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const reason =
        error && typeof error === "object" && "reason" in error
          ? String(error.reason)
          : "unknown";
      console.error("Clerk token verification failed:", reason, message);
      return c.json({ error: "Unauthorized" }, 401);
    }
  };
}

/**
 * Attach a verified Clerk user id when a Bearer token is present.
 * Missing or invalid tokens leave the request anonymous (no 401).
 */
export function optionalUserId() {
  return async (c: Context, next: Next) => {
    const token = extractBearerToken(c.req.header("Authorization"));
    if (!token) {
      await next();
      return;
    }

    try {
      const payload = await verifySessionToken(token);
      if (payload.sub) {
        c.set("userId", payload.sub);
      }
    } catch {
      // Anonymous share viewers may send stale tokens; ignore verification failures.
    }

    await next();
  };
}

export function getRequestUserId(c: Context): string {
  const userId = c.get("userId") as string | undefined;
  if (!userId) {
    throw new Error("User id missing from request context");
  }
  return userId;
}

export function getOptionalRequestUserId(c: Context): string | undefined {
  return c.get("userId") as string | undefined;
}
