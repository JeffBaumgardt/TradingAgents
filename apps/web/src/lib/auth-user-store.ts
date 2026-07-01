/**
 * @file apps/web/src/lib/auth-user-store.ts
 * In-memory Clerk user id for non-hook API client calls.
 */

let currentUserId: string | null = null;

export function setCurrentUserId(userId: string | null): void {
  currentUserId = userId;
}

export function getCurrentUserId(): string | null {
  return currentUserId;
}

export function requireCurrentUserId(): string {
  if (!currentUserId) {
    throw new Error("Signed-in Clerk user id is required");
  }
  return currentUserId;
}
