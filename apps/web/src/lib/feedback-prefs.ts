/**
 * @file apps/web/src/lib/feedback-prefs.ts
 * localStorage helpers for post-run feedback nudge opt-out / per-session dismiss.
 */

const OPT_OUT_KEY = "tradingagents:feedback-opt-out";

function dismissedKey(sessionId: string): string {
  return `tradingagents:feedback-dismissed:${sessionId}`;
}

function canUseStorage(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export function isFeedbackOptedOut(): boolean {
  if (!canUseStorage()) {
    return false;
  }
  return window.localStorage.getItem(OPT_OUT_KEY) === "1";
}

export function setFeedbackOptOut(): void {
  if (!canUseStorage()) {
    return;
  }
  window.localStorage.setItem(OPT_OUT_KEY, "1");
}

export function isFeedbackDismissedForSession(sessionId: string): boolean {
  if (!canUseStorage() || !sessionId) {
    return false;
  }
  return window.localStorage.getItem(dismissedKey(sessionId)) === "1";
}

export function dismissFeedbackForSession(sessionId: string): void {
  if (!canUseStorage() || !sessionId) {
    return;
  }
  window.localStorage.setItem(dismissedKey(sessionId), "1");
}
