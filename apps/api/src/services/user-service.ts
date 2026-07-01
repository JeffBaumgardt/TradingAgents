/**
 * apps/api/src/services/user-service.ts
 *
 * Clerk-backed user records. The user id is the Clerk user id (user_xxx).
 */

import { eq } from "drizzle-orm";
import type { UpdateUserRequest, User } from "@tradingagents/api-types";
import { db } from "../db/index.js";
import { users, type UserRow } from "../db/schema.js";

export interface UpsertUserInput {
  id: string;
  email?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  imageUrl?: string | null;
}

function rowToUser(row: UserRow): User {
  return {
    id: row.id,
    email: row.email,
    firstName: row.firstName,
    lastName: row.lastName,
    imageUrl: row.imageUrl,
    createdAt: new Date(row.createdAt).toISOString(),
    updatedAt: new Date(row.updatedAt).toISOString(),
  };
}

export async function getUserById(id: string): Promise<User | null> {
  const row = (await db.select().from(users).where(eq(users.id, id)).limit(1))[0];
  return row ? rowToUser(row) : null;
}

export async function upsertUser(input: UpsertUserInput): Promise<User> {
  const now = new Date();
  const existing = (
    await db.select().from(users).where(eq(users.id, input.id)).limit(1)
  )[0];

  if (existing) {
    const nextEmail = input.email !== undefined ? input.email : existing.email;
    const nextFirstName =
      input.firstName !== undefined ? input.firstName : existing.firstName;
    const nextLastName =
      input.lastName !== undefined ? input.lastName : existing.lastName;
    const nextImageUrl =
      input.imageUrl !== undefined ? input.imageUrl : existing.imageUrl;

    await db
      .update(users)
      .set({
        email: nextEmail,
        firstName: nextFirstName,
        lastName: nextLastName,
        imageUrl: nextImageUrl,
        updatedAt: now,
      })
      .where(eq(users.id, input.id));
  } else {
    await db.insert(users).values({
      id: input.id,
      email: input.email ?? null,
      firstName: input.firstName ?? null,
      lastName: input.lastName ?? null,
      imageUrl: input.imageUrl ?? null,
      createdAt: now,
      updatedAt: now,
    });
  }

  const row = (await db.select().from(users).where(eq(users.id, input.id)).limit(1))[0];
  if (!row) {
    throw new Error("Failed to upsert user");
  }
  return rowToUser(row);
}

export async function ensureUser(id: string): Promise<User> {
  const existing = await getUserById(id);
  if (existing) {
    return existing;
  }
  return upsertUser({ id });
}

export async function updateUserProfile(
  id: string,
  profile: UpdateUserRequest,
): Promise<User> {
  return upsertUser({
    id,
    email: profile.email,
    firstName: profile.firstName,
    lastName: profile.lastName,
    imageUrl: profile.imageUrl,
  });
}

export async function deleteUser(id: string): Promise<boolean> {
  const existing = (
    await db.select().from(users).where(eq(users.id, id)).limit(1)
  )[0];
  if (!existing) {
    return false;
  }

  await db.delete(users).where(eq(users.id, id));
  return true;
}

export function primaryEmailFromClerkUser(data: {
  email_addresses?: Array<{ email_address?: string }>;
}): string | null {
  return data.email_addresses?.[0]?.email_address ?? null;
}
