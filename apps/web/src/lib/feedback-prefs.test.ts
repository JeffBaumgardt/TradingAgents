/**
 * @file apps/web/src/lib/feedback-prefs.test.ts
 * localStorage helpers for post-run feedback nudge preferences.
 */

import { describe, it, expect, afterEach, beforeEach } from "vitest";
import {
  dismissFeedbackForSession,
  isFeedbackDismissedForSession,
  isFeedbackOptedOut,
  setFeedbackOptOut,
} from "./feedback-prefs";

const OPT_OUT_KEY = "tradingagents:feedback-opt-out";
const SESSION_KEY = "tradingagents:feedback-dismissed:session-1";

const memoryStore = new Map<string, string>();

const localStorageMock = {
  getItem(key: string): string | null {
    return memoryStore.has(key) ? (memoryStore.get(key) as string) : null;
  },
  setItem(key: string, value: string): void {
    memoryStore.set(key, String(value));
  },
  removeItem(key: string): void {
    memoryStore.delete(key);
  },
  clear(): void {
    memoryStore.clear();
  },
};

beforeEach(() => {
  memoryStore.clear();
  (globalThis as { window?: unknown }).window = {
    localStorage: localStorageMock,
  };
});

afterEach(() => {
  memoryStore.clear();
  delete (globalThis as { window?: unknown }).window;
});

describe("feedback-prefs", () => {
  it("tracks forever opt-out and per-session dismiss", () => {
    expect(isFeedbackOptedOut()).toBe(false);
    expect(isFeedbackDismissedForSession("session-1")).toBe(false);

    dismissFeedbackForSession("session-1");
    expect(isFeedbackDismissedForSession("session-1")).toBe(true);
    expect(localStorageMock.getItem(SESSION_KEY)).toBe("1");
    expect(isFeedbackOptedOut()).toBe(false);

    setFeedbackOptOut();
    expect(isFeedbackOptedOut()).toBe(true);
    expect(localStorageMock.getItem(OPT_OUT_KEY)).toBe("1");
  });
});
