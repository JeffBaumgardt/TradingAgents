/**
 * apps/api/src/services/user-service.test.ts
 *
 * Verifies Clerk user records are created, updated, and removed idempotently.
 */

import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, describe, it } from "node:test";

const TEST_USER_ID = "user_test_clerk_sync";

let tempDir = "";
let ensureUser: typeof import("./user-service.js").ensureUser;
let getUserById: typeof import("./user-service.js").getUserById;
let upsertUser: typeof import("./user-service.js").upsertUser;
let updateUserProfile: typeof import("./user-service.js").updateUserProfile;
let deleteUser: typeof import("./user-service.js").deleteUser;
let initializeDatabase: typeof import("../db/index.js").initializeDatabase;

before(async () => {
  tempDir = mkdtempSync(join(tmpdir(), "tradingagents-user-test-"));
  process.env.DATABASE_PATH = join(tempDir, "test.db");

  const dbModule = await import("../db/index.js");
  initializeDatabase = dbModule.initializeDatabase;
  initializeDatabase();

  const service = await import("./user-service.js");
  ensureUser = service.ensureUser;
  getUserById = service.getUserById;
  upsertUser = service.upsertUser;
  updateUserProfile = service.updateUserProfile;
  deleteUser = service.deleteUser;
});

after(() => {
  rmSync(tempDir, { recursive: true, force: true });
});

describe("user-service", () => {
  it("creates a stub user on ensureUser", async () => {
    const user = await ensureUser(`${TEST_USER_ID}-stub`);
    assert.equal(user.id, `${TEST_USER_ID}-stub`);
    assert.equal(user.email, null);
    assert.ok(user.createdAt);
  });

  it("is idempotent when ensureUser is called twice", async () => {
    const first = await ensureUser(`${TEST_USER_ID}-idempotent`);
    const second = await ensureUser(`${TEST_USER_ID}-idempotent`);
    assert.equal(first.id, second.id);
    assert.equal(first.createdAt, second.createdAt);
  });

  it("upserts profile fields without clearing unspecified values", async () => {
    await upsertUser({
      id: `${TEST_USER_ID}-profile`,
      email: "first@example.com",
      firstName: "Ada",
      lastName: "Lovelace",
    });

    const updated = await updateUserProfile(`${TEST_USER_ID}-profile`, {
      email: "second@example.com",
    });

    assert.equal(updated.email, "second@example.com");
    assert.equal(updated.firstName, "Ada");
    assert.equal(updated.lastName, "Lovelace");
  });

  it("deletes an existing user", async () => {
    await upsertUser({ id: `${TEST_USER_ID}-delete`, email: "gone@example.com" });
    const deleted = await deleteUser(`${TEST_USER_ID}-delete`);
    assert.equal(deleted, true);
    assert.equal(await getUserById(`${TEST_USER_ID}-delete`), null);
  });
});
