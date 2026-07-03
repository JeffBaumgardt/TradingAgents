/**
 * apps/api/src/lib/session-status.test.ts
 *
 * Verifies live vs terminal session status helpers used by the run UI.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isLiveSessionStatus } from "@tradingagents/api-types";

describe("isLiveSessionStatus", () => {
  it("returns true for pending and running sessions", () => {
    assert.equal(isLiveSessionStatus("pending"), true);
    assert.equal(isLiveSessionStatus("running"), true);
  });

  it("returns false for terminal sessions", () => {
    assert.equal(isLiveSessionStatus("completed"), false);
    assert.equal(isLiveSessionStatus("error"), false);
    assert.equal(isLiveSessionStatus("cancelled"), false);
  });
});
