/**
 * @file apps/web/src/components/RunExportBar.tsx
 * Save, export, and share actions for completed analysis runs.
 */

"use client";

import { useAuth } from "@clerk/nextjs";
import { useState } from "react";
import { getSessionExportMarkdownUrl } from "@/lib/api-client";
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
  const { getToken } = useAuth();
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isSharing, setIsSharing] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

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

  async function handleDownloadMarkdown() {
    if (isDownloading) {
      return;
    }
    setIsDownloading(true);
    try {
      const token = await getToken();
      const response = await fetch(getSessionExportMarkdownUrl(sessionId), {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        cache: "no-store",
      });
      if (!response.ok) {
        throw new Error("Could not download export");
      }
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = `${ticker.toLowerCase()}-tradingagents-export.md`;
      anchor.click();
      URL.revokeObjectURL(objectUrl);
      showFeedback("Markdown downloaded");
    } catch (error) {
      showFeedback(
        error instanceof Error ? error.message : "Could not download export",
      );
    } finally {
      setIsDownloading(false);
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
          className={styles.secondaryButton}
          onClick={() => void handleDownloadMarkdown()}
          disabled={isDownloading}
          aria-busy={isDownloading}
          aria-label="Download research and chat as markdown"
        >
          {isDownloading ? "Preparing…" : "Download .md"}
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
          Download .md for a full prompt-ready export (research + chat). Share PNG
          for the Trade Check digest.
        </p>
      )}
    </div>
  );
}
