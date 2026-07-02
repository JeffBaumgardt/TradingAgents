/**
 * apps/api/src/services/user-service.ts
 *
 * Clerk-backed user records. The user id is the Clerk user id (user_xxx).
 * Upserts dedupe by email so duplicate Clerk webhook deliveries (or multiple
 * Clerk user ids for the same address) collapse to one row keyed by Clerk id.
 */

import type { UpdateUserRequest, User } from "@tradingagents/api-types";
import type { AppSupabaseClient, UserRow } from "@tradingagents/supabase";

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

export function normalizeEmail(email: string | null | undefined): string | null {
  if (!email) {
    return null;
  }
  const normalized = email.trim().toLowerCase();
  return normalized || null;
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

async function getUserRowByEmail(
  client: AppSupabaseClient,
  email: string,
): Promise<UserRow | null> {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) {
    return null;
  }

  const { data, error } = await client
    .from("users")
    .select("*")
    .eq("email", normalizedEmail)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return (data as UserRow | null) ?? null;
}

async function migrateUserCredentials(
  client: AppSupabaseClient,
  fromUserId: string,
  toUserId: string,
): Promise<void> {
  if (fromUserId === toUserId) {
    return;
  }

  const { error } = await client
    .from("user_credentials")
    .update({ user_id: toUserId })
    .eq("user_id", fromUserId);

  if (error) {
    throw new Error(error.message);
  }
}

async function rekeyUser(
  client: AppSupabaseClient,
  existing: UserRow,
  nextId: string,
  input: UpsertUserInput,
  now: string,
): Promise<void> {
  if (existing.id === nextId) {
    return;
  }

  await migrateUserCredentials(client, existing.id, nextId);

  const { error: deleteError } = await client.from("users").delete().eq("id", existing.id);
  if (deleteError) {
    throw new Error(deleteError.message);
  }

  const normalizedEmail = normalizeEmail(input.email ?? existing.email);
  const { error: insertError } = await client.from("users").insert({
    id: nextId,
    email: normalizedEmail,
    first_name: input.firstName !== undefined ? input.firstName : existing.first_name,
    last_name: input.lastName !== undefined ? input.lastName : existing.last_name,
    image_url: input.imageUrl !== undefined ? input.imageUrl : existing.image_url,
    created_at: existing.created_at,
    updated_at: now,
  });

  if (insertError) {
    throw new Error(insertError.message);
  }
}

async function updateExistingUser(
  client: AppSupabaseClient,
  id: string,
  existing: UserRow,
  input: UpsertUserInput,
  now: string,
): Promise<User> {
  const normalizedEmail =
    input.email !== undefined ? normalizeEmail(input.email) : existing.email;

  const { error } = await client
    .from("users")
    .update({
      email: normalizedEmail,
      first_name:
        input.firstName !== undefined ? input.firstName : existing.first_name,
      last_name: input.lastName !== undefined ? input.lastName : existing.last_name,
      image_url: input.imageUrl !== undefined ? input.imageUrl : existing.image_url,
      updated_at: now,
    })
    .eq("id", id);

  if (error) {
    throw new Error(error.message);
  }

  const user = await getUserById(client, id);
  if (!user) {
    throw new Error("Failed to update user");
  }
  return user;
}

export async function upsertUser(
  client: AppSupabaseClient,
  input: UpsertUserInput,
): Promise<User> {
  const now = new Date().toISOString();
  const normalizedEmail = normalizeEmail(input.email);

  const existingByIdRow = (await client
    .from("users")
    .select("*")
    .eq("id", input.id)
    .maybeSingle()).data as UserRow | null;

  if (existingByIdRow) {
    return updateExistingUser(client, input.id, existingByIdRow, input, now);
  }

  if (normalizedEmail) {
    const existingByEmail = await getUserRowByEmail(client, normalizedEmail);
    if (existingByEmail) {
      if (existingByEmail.id !== input.id) {
        await rekeyUser(client, existingByEmail, input.id, input, now);
      }
      const row = (await client
        .from("users")
        .select("*")
        .eq("id", input.id)
        .maybeSingle()).data as UserRow | null;
      if (!row) {
        throw new Error("Failed to rekey user");
      }
      return updateExistingUser(client, input.id, row, input, now);
    }
  }

  const { error } = await client.from("users").insert({
    id: input.id,
    email: normalizedEmail,
    first_name: input.firstName ?? null,
    last_name: input.lastName ?? null,
    image_url: input.imageUrl ?? null,
    created_at: now,
    updated_at: now,
  });

  if (error) {
    throw new Error(error.message);
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
