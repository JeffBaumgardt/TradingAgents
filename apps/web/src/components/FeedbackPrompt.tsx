/**
 * @file apps/web/src/components/FeedbackPrompt.tsx
 * Compact post-run nudge asking for feedback after a successful analysis.
 */

"use client";

import { useEffect, useState } from "react";
import FeedbackModal from "@/components/FeedbackModal";
import {
  dismissFeedbackForSession,
  isFeedbackDismissedForSession,
  isFeedbackOptedOut,
  setFeedbackOptOut,
} from "@/lib/feedback-prefs";
import styles from "./FeedbackPrompt.module.css";

interface FeedbackPromptProps {
  sessionId: string;
}

export default function FeedbackPrompt({ sessionId }: FeedbackPromptProps) {
  const [showNudge, setShowNudge] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    if (!sessionId) {
      setShowNudge(false);
      return;
    }

    setShowNudge(
      !isFeedbackOptedOut() && !isFeedbackDismissedForSession(sessionId),
    );
  }, [sessionId]);

  if (!showNudge && !modalOpen) {
    return null;
  }

  function handleShare() {
    setModalOpen(true);
  }

  function handleNotNow() {
    dismissFeedbackForSession(sessionId);
    setShowNudge(false);
  }

  function handleDontAskAgain() {
    setFeedbackOptOut();
    setShowNudge(false);
  }

  function handleCloseModal() {
    setModalOpen(false);
  }

  function handleSubmitted() {
    dismissFeedbackForSession(sessionId);
    setShowNudge(false);
  }

  return (
    <>
      {showNudge ? (
        <div className={styles.prompt} data-print-hide="true" role="region" aria-label="Feedback">
          <p className={styles.ask}>Was this analysis useful? Share quick feedback.</p>
          <div className={styles.actions}>
            <button type="button" className={styles.primaryButton} onClick={handleShare}>
              Share feedback
            </button>
            <button type="button" className={styles.secondaryButton} onClick={handleNotNow}>
              Not now
            </button>
            <button
              type="button"
              className={styles.ghostButton}
              onClick={handleDontAskAgain}
            >
              Don’t ask again
            </button>
          </div>
        </div>
      ) : null}
      <FeedbackModal
        open={modalOpen}
        onClose={handleCloseModal}
        source="post_run"
        sessionId={sessionId}
        onSubmitted={handleSubmitted}
      />
    </>
  );
}
