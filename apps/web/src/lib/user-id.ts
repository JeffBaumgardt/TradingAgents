/**
 * @file apps/web/src/lib/user-id.ts
 * Stable anonymous user id persisted in localStorage for credential scoping.
 * Replace with authenticated user id when auth is wired up.
 */

const STORAGE_KEY = "tradingagents:userId";

function createUserId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `user-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function getOrCreateUserId(): string {
  if (typeof window === "undefined") {
    return "";
  }

  const existing = window.localStorage.getItem(STORAGE_KEY);
  if (existing) {
    return existing;
  }

  const userId = createUserId();
  window.localStorage.setItem(STORAGE_KEY, userId);
  return userId;
}
