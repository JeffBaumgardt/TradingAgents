/**
 * @file packages/utils/src/user-context.test.ts
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  MAX_USER_CONTEXT_LENGTH,
  sanitizeUserContext,
  validateUserContext,
} from "./user-context.js";

describe("validateUserContext", () => {
  it("accepts empty and undefined values", () => {
    assert.equal(validateUserContext(undefined), null);
    assert.equal(validateUserContext(null), null);
    assert.equal(validateUserContext("   "), null);
  });

  it("accepts normal investing context", () => {
    assert.equal(validateUserContext("I own 100 shares of SPY."), null);
  });

  it("rejects null bytes and control characters", () => {
    assert.match(validateUserContext("hello\x00world") ?? "", /invalid characters/);
    assert.match(validateUserContext("hello\x1Fworld") ?? "", /invalid characters/);
  });

  it("does not bypass validation on back-to-back calls", () => {
    assert.match(validateUserContext("hello\x1Fworld") ?? "", /invalid characters/);
    assert.match(validateUserContext("ab\x1F") ?? "", /invalid characters/);
  });

  it("rejects oversized context", () => {
    const tooLong = "a".repeat(MAX_USER_CONTEXT_LENGTH + 1);
    assert.match(validateUserContext(tooLong) ?? "", /at most/);
  });
});

describe("sanitizeUserContext", () => {
  it("returns undefined for empty input", () => {
    assert.equal(sanitizeUserContext(undefined), undefined);
    assert.equal(sanitizeUserContext("  "), undefined);
  });

  it("strips control characters and trims", () => {
    assert.equal(sanitizeUserContext("  hello\x1Fworld  "), "helloworld");
  });

  it("truncates to max length", () => {
    const long = "x".repeat(MAX_USER_CONTEXT_LENGTH + 50);
    assert.equal(sanitizeUserContext(long)?.length, MAX_USER_CONTEXT_LENGTH);
  });
});
