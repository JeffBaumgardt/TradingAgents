/**
 * @file apps/web/src/lib/user-id.ts
 * Helpers for attaching the Clerk user id to API requests.
 */

import { getCurrentUserId } from "@/lib/auth-user-store";

export function buildUserIdHeader(userId: string | null = getCurrentUserId()): HeadersInit {
  if (!userId) {
    return {};
  }
  return { "X-User-Id": userId };
}
