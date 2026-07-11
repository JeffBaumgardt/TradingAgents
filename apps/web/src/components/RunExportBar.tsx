/**
 * @file apps/web/src/components/RunExportBar.tsx
 * Save, export, and share actions for completed analysis runs.
 */

"use client";

import { useState } from "react";
import { shareTradeCheckPng } from "@/lib/trade-check-share";
import styles from "./RunExportBar.module.css";

interface RunExportBarProps {
  sessionId: string;
  ticker: string;
  canShareDigest?: boolean;
}

export default function RunExportBar({
  sessionId,
  ticker,
  canShareDigest = false,
}: RunExportBarProps) {
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isSharing, setIsSharing] = useState(false);

  function showFeedback(message: string) {
    setFeedback(message);
    window.setTimeout(() => setFeedback(null), 3500);
  }

  async function handleCopyLink() {
    const url = `${window.location.origin}/run/${sessionId}`;
    try {
      await navigator.clipboard.writeText(url);
      showFeedback("Link copied");
    } catch {
      showFeedback("Could not copy link");
    }
  }

  async function handleShare() {
    if (!canShareDigest || isSharing) {
      return;
    }

    setIsSharing(true);
    try {
      const result = await shareTradeCheckPng(ticker);
      if (result === "clipboard") {
        showFeedback("PNG copied — paste into Discord");
      } else if (result === "share") {
        showFeedback("PNG ready to share");
      } else {
        showFeedback("PNG downloaded — drop into Discord");
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }
      showFeedback(
        error instanceof Error ? error.message : "Could not create Trade Check PNG",
      );
    } finally {
      setIsSharing(false);
    }
  }

  return (
    <div className={styles.bar} data-print-hide="true">
      <div className={styles.actions}>
        <button type="button" className={styles.secondaryButton} onClick={handleCopyLink}>
          Copy link
        </button>
        <button
          type="button"
          className={styles.primaryButton}
          onClick={handleShare}
          disabled={!canShareDigest || isSharing}
          aria-busy={isSharing}
        >
          {isSharing ? "Creating PNG…" : "Share PNG"}
        </button>
      </div>
      {feedback ? (
        <p className={styles.feedback} role="status" aria-live="polite">
          {feedback}
        </p>
      ) : (
        <p className={styles.hint}>
          Share PNG copies or downloads the Trade Check digest for Discord.
        </p>
      )}
    </div>
  );
}
