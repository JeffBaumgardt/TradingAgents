/**
 * apps/api/src/middleware/user-context.ts
 *
 * Verifies Clerk session JWTs and attaches the authenticated user id to the request.
 * User id comes from the token subject claim — never from client-supplied headers alone.
 */

import { verifyToken } from "@clerk/backend";
import type { Context, Next } from "hono";

function readBearerToken(c: Context): string | null {
  const authorization = c.req.header("Authorization")?.trim();
  if (!authorization?.startsWith("Bearer ")) {
    return null;
  }
  const token = authorization.slice("Bearer ".length).trim();
  return token || null;
}

async function resolveAuthenticatedUserId(c: Context): Promise<string | null> {
  const token = readBearerToken(c);
  if (!token) {
    return null;
  }

  try {
    const payload = await verifyToken(token, {
      secretKey: process.env.CLERK_SECRET_KEY,
      jwtKey: process.env.CLERK_JWT_KEY,
    });
    return typeof payload.sub === "string" ? payload.sub : null;
  } catch {
    return null;
  }
}

export function requireUserId() {
  return async (c: Context, next: Next) => {
    const userId = await resolveAuthenticatedUserId(c);
    if (!userId) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    c.set("userId", userId);
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
