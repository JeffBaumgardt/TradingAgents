/**
 * @file apps/web/src/components/RecentSessionItem.tsx
 * Client row with delete action; list data is server-rendered.
 */

"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Session } from "@tradingagents/api-types";
import { ApiClientError, deleteSession } from "@/lib/api-client";
import {
  formatSessionDate,
  sessionStatusClassSuffix,
  sessionStatusLabel,
} from "@/lib/session-display";
import styles from "./RecentSessions.module.css";

interface RecentSessionItemProps {
  session: Session;
}

export default function RecentSessionItem({ session }: RecentSessionItemProps) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const statusClassKey = sessionStatusClassSuffix(session.status);

  async function handleDelete() {
    const confirmed = window.confirm(
      `Delete the ${session.ticker} analysis from ${formatSessionDate(session.analysisDate)}? This cannot be undone.`,
    );
    if (!confirmed) {
      return;
    }

    setDeleting(true);
    setError(null);
    try {
      await deleteSession(session.id);
      router.refresh();
    } catch (err) {
      setError(
        err instanceof ApiClientError ? err.message : "Failed to delete session.",
      );
    } finally {
      setDeleting(false);
    }
  }

  return (
    <li className={styles.item}>
      <Link href={`/run/${session.id}`} className={styles.rowLink}>
        <span className={styles.primary}>
          <span className={styles.ticker}>{session.ticker}</span>
          <span className={styles.date}>{formatSessionDate(session.analysisDate)}</span>
        </span>
        <span className={styles.meta}>
          {session.decision ? (
            <span className={styles.decision}>{session.decision}</span>
          ) : null}
          <span className={`${styles.status} ${styles[statusClassKey as keyof typeof styles]}`}>
            {sessionStatusLabel(session.status)}
          </span>
        </span>
      </Link>
      <button
        type="button"
        className={styles.deleteButton}
        aria-label={`Delete ${session.ticker} session from ${formatSessionDate(session.analysisDate)}`}
        aria-busy={deleting}
        disabled={deleting}
        onClick={() => void handleDelete()}
      >
        <svg
          className={styles.deleteIcon}
          viewBox="0 0 12 12"
          width="12"
          height="12"
          aria-hidden
        >
          <path
            d="M2.5 2.5l7 7M9.5 2.5l-7 7"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      </button>
      {error ? (
        <span className={styles.error} role="alert">
          {error}
        </span>
      ) : null}
    </li>
  );
}
