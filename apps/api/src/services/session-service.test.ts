/**
 * apps/api/src/services/session-service.test.ts
 *
 * Verifies analysis sessions are scoped to their owning user.
 */

import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, describe, it } from "node:test";

const USER_A = "user_owner_a";
const USER_B = "user_owner_b";

let tempDir = "";
let db: typeof import("../db/index.js").db;
let sessions: typeof import("../db/schema.js").sessions;
let listSessions: typeof import("./session-service.js").listSessions;
let getSession: typeof import("./session-service.js").getSession;
let deleteSession: typeof import("./session-service.js").deleteSession;
let initializeDatabase: typeof import("../db/index.js").initializeDatabase;

async function insertSession(id: string, userId: string, ticker: string): Promise<void> {
  const now = new Date();
  await db.insert(sessions).values({
    id,
    userId,
    ticker,
    analysisDate: "2026-06-26",
    status: "completed",
    config: {
      ticker,
      analysisDate: "2026-06-26",
      outputLanguage: "English",
      analysts: ["market"],
      researchDepth: 1,
      llmProvider: "openai",
      quickThinkLlm: "gpt-4o-mini",
      deepThinkLlm: "gpt-4o",
    },
    createdAt: now,
    updatedAt: now,
  });
}

before(async () => {
  tempDir = mkdtempSync(join(tmpdir(), "tradingagents-session-test-"));
  process.env.DATABASE_PATH = join(tempDir, "test.db");

  const dbModule = await import("../db/index.js");
  db = dbModule.db;
  initializeDatabase = dbModule.initializeDatabase;
  initializeDatabase();

  const schemaModule = await import("../db/schema.js");
  sessions = schemaModule.sessions;

  const sessionModule = await import("./session-service.js");
  listSessions = sessionModule.listSessions;
  getSession = sessionModule.getSession;
  deleteSession = sessionModule.deleteSession;
});

after(() => {
  rmSync(tempDir, { recursive: true, force: true });
});

describe("session-service ownership", () => {
  it("lists and reads sessions only for the owning user", async () => {
    await insertSession("session-a-1", USER_A, "SPY");

    const ownerList = await listSessions(USER_A, 20, 0);
    assert.equal(ownerList.total, 1);
    assert.equal(ownerList.items[0]?.id, "session-a-1");

    const otherList = await listSessions(USER_B, 20, 0);
    assert.equal(otherList.total, 0);

    assert.notEqual(await getSession("session-a-1", USER_A), null);
    assert.equal(await getSession("session-a-1", USER_B), null);
  });

  it("prevents deleting another user's session", async () => {
    await insertSession("session-a-2", USER_A, "QQQ");

    assert.equal(await deleteSession("session-a-2", USER_B), false);
    assert.notEqual(await getSession("session-a-2", USER_A), null);

    assert.equal(await deleteSession("session-a-2", USER_A), true);
    assert.equal(await getSession("session-a-2", USER_A), null);
  });
});
