/**
 * @file apps/web/src/lib/auth-user-store.ts
 * Clerk auth helpers for non-hook API client calls.
 */

let currentUserId: string | null = null;
type TokenGetter = () => Promise<string | null>;
let tokenGetter: TokenGetter | null = null;

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

export function setTokenGetter(getter: TokenGetter | null): void {
  tokenGetter = getter;
}

export async function buildAuthHeaders(): Promise<HeadersInit> {
  if (!tokenGetter) {
    return {};
  }

  const token = await tokenGetter();
  if (!token) {
    return {};
  }

  return { Authorization: `Bearer ${token}` };
}
