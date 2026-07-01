/**
 * apps/api/src/middleware/user-context.ts
 *
 * Associates requests with a caller user id via the X-User-Id header.
 * The web client generates and persists this id locally until auth is added.
 */

import type { Context, Next } from "hono";

export function requireUserId() {
  return async (c: Context, next: Next) => {
    const userId = c.req.header("X-User-Id")?.trim();
    if (!userId) {
      return c.json({ error: "Missing X-User-Id header" }, 401);
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
