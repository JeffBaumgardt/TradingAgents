/**
 * apps/api/src/services/user-service.test.ts
 *
 * Verifies Clerk user records are created, updated, and removed idempotently.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createInMemorySupabase } from "../test/in-memory-supabase.js";
import {
  deleteUser,
  ensureUser,
  getUserById,
  updateUserProfile,
  upsertUser,
} from "./user-service.js";

const TEST_USER_ID = "user_test_clerk_sync";

describe("user-service", () => {
  it("creates a stub user on ensureUser", async () => {
    const client = createInMemorySupabase();
    const user = await ensureUser(client, `${TEST_USER_ID}-stub`);
    assert.equal(user.id, `${TEST_USER_ID}-stub`);
    assert.equal(user.email, null);
    assert.ok(user.createdAt);
  });

  it("is idempotent when ensureUser is called twice", async () => {
    const client = createInMemorySupabase();
    const first = await ensureUser(client, `${TEST_USER_ID}-idempotent`);
    const second = await ensureUser(client, `${TEST_USER_ID}-idempotent`);
    assert.equal(first.id, second.id);
    assert.equal(first.createdAt, second.createdAt);
  });

  it("upserts profile fields without clearing unspecified values", async () => {
    const client = createInMemorySupabase();
    await upsertUser(client, {
      id: `${TEST_USER_ID}-profile`,
      email: "first@example.com",
      firstName: "Ada",
      lastName: "Lovelace",
    });

    const updated = await updateUserProfile(client, `${TEST_USER_ID}-profile`, {
      email: "second@example.com",
    });

    assert.equal(updated.email, "second@example.com");
    assert.equal(updated.firstName, "Ada");
    assert.equal(updated.lastName, "Lovelace");
  });

  it("deletes an existing user", async () => {
    const client = createInMemorySupabase();
    await upsertUser(client, { id: `${TEST_USER_ID}-delete`, email: "gone@example.com" });
    const deleted = await deleteUser(client, `${TEST_USER_ID}-delete`);
    assert.equal(deleted, true);
    assert.equal(await getUserById(client, `${TEST_USER_ID}-delete`), null);
  });
});
