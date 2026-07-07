/**
 * @file apps/web/src/components/RunExportBar.tsx
 * Save, export, and share actions for completed analysis runs.
 */

"use client";

import { useState } from "react";
import styles from "./RunExportBar.module.css";

interface RunExportBarProps {
  sessionId: string;
  ticker: string;
  onPrintDigest: () => void;
  onPrintFull: () => void;
}

export default function RunExportBar({
  sessionId,
  ticker,
  onPrintDigest,
  onPrintFull,
}: RunExportBarProps) {
  const [copyMessage, setCopyMessage] = useState<string | null>(null);

  async function handleCopyLink() {
    const url = `${window.location.origin}/run/${sessionId}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopyMessage("Link copied");
    } catch {
      setCopyMessage("Could not copy link");
    }
    window.setTimeout(() => setCopyMessage(null), 2500);
  }

  async function handleShare() {
    const url = `${window.location.origin}/run/${sessionId}`;
    const title = `${ticker} Trade Check`;
    const text = `Analysis report for ${ticker}`;

    if (navigator.share) {
      try {
        await navigator.share({ title, text, url });
        return;
      } catch {
        // User cancelled or share failed — fall back to copy.
      }
    }

    await handleCopyLink();
  }

  return (
    <div className={styles.bar} data-print-hide="true">
      <div className={styles.actions}>
        <button type="button" className={styles.primaryButton} onClick={onPrintDigest}>
          Save / Print digest
        </button>
        <button type="button" className={styles.secondaryButton} onClick={onPrintFull}>
          Export full report
        </button>
        <button type="button" className={styles.secondaryButton} onClick={handleCopyLink}>
          Copy link
        </button>
        <button type="button" className={styles.secondaryButton} onClick={handleShare}>
          Share
        </button>
      </div>
      {copyMessage ? (
        <p className={styles.feedback} role="status" aria-live="polite">
          {copyMessage}
        </p>
      ) : (
        <p className={styles.hint}>
          Digest prints the Trade Check summary. Full export adds every agent report on following pages.
        </p>
      )}
    </div>
  );
}
