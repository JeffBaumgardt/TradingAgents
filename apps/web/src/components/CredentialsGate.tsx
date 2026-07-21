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

const BILLING_POLL_ATTEMPTS = 5;
const BILLING_POLL_INTERVAL_MS = 750;

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export default function CredentialsGate({ children }: CredentialsGateProps) {
  const router = useRouter();
  const { credentialsReady, hydrating } = useUserSession();
  const [hostedAccess, setHostedAccess] = useState<boolean | null>(null);
  const [billingLoadFailed, setBillingLoadFailed] = useState(false);
  const [retryToken, setRetryToken] = useState(0);

  useEffect(() => {
    if (hydrating || credentialsReady) {
      setHostedAccess(null);
      setBillingLoadFailed(false);
      return;
    }

    let cancelled = false;

    async function checkHostedAccess() {
      setBillingLoadFailed(false);
      setHostedAccess(null);

      for (let attempt = 0; attempt < BILLING_POLL_ATTEMPTS; attempt += 1) {
        try {
          const account = await fetchBillingAccount();
          if (cancelled) {
            return;
          }
          setHostedAccess(
            account.subscription.planId === "hosted" &&
              account.subscription.status === "active",
          );
          return;
        } catch {
          if (attempt < BILLING_POLL_ATTEMPTS - 1) {
            await wait(BILLING_POLL_INTERVAL_MS);
          }
        }
      }

      if (!cancelled) {
        // Do not treat load failures as "not hosted" — that incorrectly
        // sends active Hosted subscribers to the credentials page.
        setBillingLoadFailed(true);
      }
    }

    void checkHostedAccess();
    return () => {
      cancelled = true;
    };
  }, [credentialsReady, hydrating, retryToken]);

  useEffect(() => {
    if (!hydrating && !credentialsReady && hostedAccess === false) {
      router.replace("/settings/credentials");
    }
  }, [credentialsReady, hydrating, hostedAccess, router]);

  function handleRetry() {
    setRetryToken((token) => token + 1);
  }

  if (hydrating || (!credentialsReady && hostedAccess === null && !billingLoadFailed)) {
    return <HomePageSkeleton />;
  }

  if (!credentialsReady && billingLoadFailed) {
    return (
      <div role="alert" aria-live="polite" style={{ padding: "2rem", textAlign: "center" }}>
        <p>Could not verify your subscription. Check your connection and try again.</p>
        <button type="button" onClick={handleRetry} aria-label="Retry subscription check">
          Retry
        </button>
      </div>
    );
  }

  if (!credentialsReady && !hostedAccess) {
    return null;
  }

  return children;
}
