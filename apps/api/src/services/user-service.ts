/**
 * apps/api/src/services/user-service.ts
 *
 * Clerk-backed user records. The user id is the Clerk user id (user_xxx).
 */

import type { UpdateUserRequest, User } from "@tradingagents/api-types";
import type { AppSupabaseClient, UserRow } from "../db/database.js";

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
    firstName: row.first_name,
    lastName: row.last_name,
    imageUrl: row.image_url,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getUserById(
  client: AppSupabaseClient,
  id: string,
): Promise<User | null> {
  const { data, error } = await client
    .from("users")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  const row = data as UserRow | null;
  return row ? rowToUser(row) : null;
}

export async function upsertUser(
  client: AppSupabaseClient,
  input: UpsertUserInput,
): Promise<User> {
  const now = new Date().toISOString();
  const { data: existing, error: existingError } = await client
    .from("users")
    .select("*")
    .eq("id", input.id)
    .maybeSingle();

  if (existingError) {
    throw new Error(existingError.message);
  }

  const existingRow = existing as UserRow | null;

  if (existingRow) {
    const { error } = await client
      .from("users")
      .update({
        email: input.email !== undefined ? input.email : existingRow.email,
        first_name:
          input.firstName !== undefined ? input.firstName : existingRow.first_name,
        last_name:
          input.lastName !== undefined ? input.lastName : existingRow.last_name,
        image_url:
          input.imageUrl !== undefined ? input.imageUrl : existingRow.image_url,
        updated_at: now,
      })
      .eq("id", input.id);

    if (error) {
      throw new Error(error.message);
    }
  } else {
    const { error } = await client.from("users").insert({
      id: input.id,
      email: input.email ?? null,
      first_name: input.firstName ?? null,
      last_name: input.lastName ?? null,
      image_url: input.imageUrl ?? null,
      created_at: now,
      updated_at: now,
    });

    if (error) {
      throw new Error(error.message);
    }
  }

  const user = await getUserById(client, input.id);
  if (!user) {
    throw new Error("Failed to upsert user");
  }
  return user;
}

export async function ensureUser(
  client: AppSupabaseClient,
  id: string,
): Promise<User> {
  const existing = await getUserById(client, id);
  if (existing) {
    return existing;
  }
  return upsertUser(client, { id });
}

export async function updateUserProfile(
  client: AppSupabaseClient,
  id: string,
  profile: UpdateUserRequest,
): Promise<User> {
  return upsertUser(client, {
    id,
    email: profile.email,
    firstName: profile.firstName,
    lastName: profile.lastName,
    imageUrl: profile.imageUrl,
  });
}

export async function deleteUser(
  client: AppSupabaseClient,
  id: string,
): Promise<boolean> {
  const existing = await getUserById(client, id);
  if (!existing) {
    return false;
  }

  const { error } = await client.from("users").delete().eq("id", id);
  if (error) {
    throw new Error(error.message);
  }
  return true;
}

export function primaryEmailFromClerkUser(data: {
  email_addresses?: Array<{ email_address?: string }>;
}): string | null {
  return data.email_addresses?.[0]?.email_address ?? null;
}
