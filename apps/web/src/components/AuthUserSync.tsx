/**
 * @file apps/web/src/components/AuthUserSync.tsx
 * Keeps the API user row in sync with Clerk and registers the session token getter.
 */

"use client";

import { useAuth, useUser } from "@clerk/nextjs";
import { useEffect, useRef } from "react";
import { syncCurrentUser } from "@/lib/api-client";
import { setClerkTokenGetter } from "@/lib/auth-headers";

interface ClerkProfileSnapshot {
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  imageUrl: string | null;
}

function buildProfileSyncKey(userId: string, profile: ClerkProfileSnapshot): string {
  return [
    userId,
    profile.email ?? "",
    profile.firstName ?? "",
    profile.lastName ?? "",
    profile.imageUrl ?? "",
  ].join("|");
}

export default function AuthUserSync() {
  const { isLoaded, isSignedIn, userId, getToken } = useAuth();
  const { user } = useUser();
  const syncedProfileKey = useRef<string | null>(null);

  setClerkTokenGetter(() => getToken());

  useEffect(() => {
    if (!isLoaded) {
      return;
    }

    if (!isSignedIn || !userId || !user) {
      syncedProfileKey.current = null;
      return;
    }

    const profile: ClerkProfileSnapshot = {
      email: user.primaryEmailAddress?.emailAddress ?? null,
      firstName: user.firstName ?? null,
      lastName: user.lastName ?? null,
      imageUrl: user.imageUrl ?? null,
    };
    const profileSyncKey = buildProfileSyncKey(userId, profile);

    if (syncedProfileKey.current === profileSyncKey) {
      return;
    }

    const activeUserId = userId;
    const activeProfile = profile;
    const activeProfileSyncKey = profileSyncKey;
    let cancelled = false;

    async function syncUser() {
      try {
        await syncCurrentUser(activeUserId, activeProfile);
        if (!cancelled) {
          syncedProfileKey.current = activeProfileSyncKey;
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
