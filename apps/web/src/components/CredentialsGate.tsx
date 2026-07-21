/**
 * @file apps/web/src/components/CredentialsGate.tsx
 * Client gate that redirects to API key setup when credentials are missing.
 * Hosted-plan users may continue without personal keys (platform inference).
 */

"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useUserSession } from "@/context/UserSessionContext";
import HomePageSkeleton from "@/components/HomePageSkeleton";
import { fetchBillingAccount } from "@/lib/api-client";

interface CredentialsGateProps {
  children: ReactNode;
}

export default function CredentialsGate({ children }: CredentialsGateProps) {
  const router = useRouter();
  const { credentialsReady, hydrating } = useUserSession();
  const [hostedAccess, setHostedAccess] = useState<boolean | null>(null);

  useEffect(() => {
    if (hydrating || credentialsReady) {
      setHostedAccess(null);
      return;
    }

    let cancelled = false;
    async function checkHostedAccess() {
      try {
        const account = await fetchBillingAccount();
        if (!cancelled) {
          setHostedAccess(
            account.subscription.planId === "hosted" &&
              account.subscription.status === "active",
          );
        }
      } catch {
        if (!cancelled) {
          setHostedAccess(false);
        }
      }
    }

    void checkHostedAccess();
    return () => {
      cancelled = true;
    };
  }, [credentialsReady, hydrating]);

  useEffect(() => {
    if (!hydrating && !credentialsReady && hostedAccess === false) {
      router.replace("/settings/credentials");
    }
  }, [credentialsReady, hydrating, hostedAccess, router]);

  if (hydrating || (!credentialsReady && hostedAccess === null)) {
    return <HomePageSkeleton />;
  }

  if (!credentialsReady && !hostedAccess) {
    return null;
  }

  return children;
}
