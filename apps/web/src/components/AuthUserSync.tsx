/**
 * @file apps/web/src/components/AuthUserSync.tsx
 * Keeps the in-memory user id and API user row in sync with Clerk.
 */

"use client";

import { useAuth, useUser } from "@clerk/nextjs";
import { useEffect, useRef } from "react";
import { syncCurrentUser } from "@/lib/api-client";
import { setCurrentUserId, setTokenGetter } from "@/lib/auth-user-store";

export default function AuthUserSync() {
  const { isLoaded, isSignedIn, userId, getToken } = useAuth();
  const { user } = useUser();
  const syncedForUserId = useRef<string | null>(null);

  if (isLoaded) {
    setCurrentUserId(isSignedIn && userId ? userId : null);
    setTokenGetter(isSignedIn ? () => getToken() : null);
  }

  useEffect(() => {
    if (!isLoaded) {
      return;
    }

    if (!isSignedIn || !userId) {
      syncedForUserId.current = null;
      return;
    }

    if (syncedForUserId.current === userId) {
      return;
    }

    const activeUserId = userId;
    let cancelled = false;

    async function syncUser() {
      try {
        await syncCurrentUser(activeUserId, {
          email: user?.primaryEmailAddress?.emailAddress ?? null,
          firstName: user?.firstName ?? null,
          lastName: user?.lastName ?? null,
          imageUrl: user?.imageUrl ?? null,
        });
        if (!cancelled) {
          syncedForUserId.current = activeUserId;
        }
      } catch (error) {
        console.error("Failed to sync Clerk user to API:", error);
      }
    }

    void syncUser();
    return () => {
      cancelled = true;
    };
  }, [isLoaded, isSignedIn, user, userId]);

  return null;
}
