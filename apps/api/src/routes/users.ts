/**
 * apps/api/src/routes/users.ts
 *
 * Current-user profile endpoints backed by Clerk user ids.
 */

import { Hono } from "hono";
import type { UpdateUserRequest } from "@tradingagents/api-types";
import { getSupabaseAdmin } from "@tradingagents/supabase";
import { getRequestUserId, requireUserId } from "../middleware/user-context.js";
import {
  ensureUser,
  getUserById,
  updateUserProfile,
} from "../services/user-service.js";

export const userRoutes = new Hono();

userRoutes.use("*", requireUserId());

userRoutes.get("/users/me", async (c) => {
  const userId = getRequestUserId(c);
  const client = getSupabaseAdmin(c);
  const user = await ensureUser(client, userId);
  return c.json(user);
});

userRoutes.put("/users/me", async (c) => {
  const userId = getRequestUserId(c);
  const body = (await c.req.json()) as UpdateUserRequest;
  const client = getSupabaseAdmin(c);
  const user = await updateUserProfile(client, userId, body);
  return c.json(user);
});

userRoutes.get("/users/:id", async (c) => {
  const requesterId = getRequestUserId(c);
  const id = c.req.param("id");
  if (id !== requesterId) {
    return c.json({ error: "Forbidden" }, 403);
  }

  const client = getSupabaseAdmin(c);
  const user = await getUserById(client, id);
  if (!user) {
    return c.json({ error: "User not found" }, 404);
  }
  return c.json(user);
});
