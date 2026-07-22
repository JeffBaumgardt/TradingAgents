/**
 * @file apps/web/src/components/BillingPageContent.tsx
 * Loads the signed-in billing account and renders the profile view.
 */

"use client";

import { useEffect, useState } from "react";
import type { BillingAccountResponse } from "@tradingagents/api-types";
import BillingAccountView from "@/components/BillingAccountView";
import { ApiClientError, fetchBillingAccount } from "@/lib/api-client";
import styles from "./BillingPageContent.module.css";

export default function BillingPageContent() {
  const [account, setAccount] = useState<BillingAccountResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadAccount() {
      try {
        const next = await fetchBillingAccount();
        if (!cancelled) {
          setAccount(next);
        }
      } catch (caught) {
        if (!cancelled) {
          setError(
            caught instanceof ApiClientError
              ? caught.message
              : "Could not load billing account.",
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadAccount();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return <p className="muted">Loading subscription…</p>;
  }

  if (error) {
    return (
      <p className={styles.error} role="alert">
        {error}
      </p>
    );
  }

  if (!account) {
    return <p className="muted">No billing account found.</p>;
  }

  return <BillingAccountView account={account} onAccountChange={setAccount} />;
}
