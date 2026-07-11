/**
 * @file apps/web/src/components/FeedbackModal.tsx
 * Modal form for submitting product feedback via the authenticated API.
 */

"use client";

import { useUser } from "@clerk/nextjs";
import {
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
  type MouseEvent,
} from "react";
import type {
  FeedbackCategory,
  FeedbackRequest,
  FeedbackSource,
} from "@tradingagents/api-types";
import { ApiClientError, submitFeedback } from "@/lib/api-client";
import styles from "./FeedbackModal.module.css";

const CATEGORY_OPTIONS: { value: FeedbackCategory; label: string }[] = [
  { value: "bug", label: "Bug" },
  { value: "idea", label: "Idea" },
  { value: "praise", label: "Praise" },
  { value: "other", label: "Other" },
];

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

interface FeedbackModalProps {
  open: boolean;
  onClose: () => void;
  source: FeedbackSource;
  sessionId?: string;
  onSubmitted?: () => void;
}

export default function FeedbackModal({
  open,
  onClose,
  source,
  sessionId,
  onSubmitted,
}: FeedbackModalProps) {
  const { user } = useUser();
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);
  const previousOverflowRef = useRef<string | null>(null);

  const [category, setCategory] = useState<FeedbackCategory | "">("");
  const [rating, setRating] = useState<1 | 2 | 3 | 4 | 5 | "">("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const signedInEmail = user?.primaryEmailAddress?.emailAddress ?? null;
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) {
      return;
    }

    previouslyFocusedRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    previousOverflowRef.current = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();

    setCategory("");
    setRating("");
    setMessage("");
    setSubmitting(false);
    setError(null);
    setSuccess(false);

    function handleKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape") {
        onCloseRef.current();
        return;
      }

      if (event.key !== "Tab" || !dialogRef.current) {
        return;
      }

      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
      ).filter((element) => !element.hasAttribute("disabled"));

      if (focusable.length === 0) {
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!first || !last) {
        return;
      }

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
        return;
      }

      if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflowRef.current ?? "";
      previouslyFocusedRef.current?.focus();
    };
  }, [open]);

  if (!open) {
    return null;
  }

  function handleBackdropClick(event: MouseEvent<HTMLDivElement>) {
    if (event.target === event.currentTarget) {
      onClose();
    }
  }

  function handleBackdropKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      onClose();
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) {
      return;
    }

    const trimmed = message.trim();
    if (!trimmed) {
      setError("Please enter a message.");
      return;
    }

    setSubmitting(true);
    setError(null);

    const body: FeedbackRequest = {
      message: trimmed,
      source,
      ...(category ? { category } : {}),
      ...(rating ? { rating } : {}),
      ...(sessionId ? { sessionId } : {}),
      pageUrl: typeof window !== "undefined" ? window.location.href : undefined,
    };

    try {
      await submitFeedback(body);
      setSuccess(true);
      onSubmitted?.();
    } catch (submitError) {
      const messageText =
        submitError instanceof ApiClientError
          ? submitError.message
          : submitError instanceof Error
            ? submitError.message
            : "Could not send feedback";
      setError(messageText);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className={styles.backdrop}
      role="presentation"
      onClick={handleBackdropClick}
      onKeyDown={handleBackdropKeyDown}
    >
      <div
        ref={dialogRef}
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div className={styles.header}>
          <h2 id={titleId} className={styles.title}>
            Share feedback
          </h2>
          <button
            ref={closeButtonRef}
            type="button"
            className={styles.closeButton}
            onClick={onClose}
            aria-label="Close feedback dialog"
          >
            ×
          </button>
        </div>

        {success ? (
          <div className={styles.success} role="status" aria-live="polite">
            <p>Thanks — your feedback was sent.</p>
            <button type="button" className={styles.primaryButton} onClick={onClose}>
              Close
            </button>
          </div>
        ) : (
          <form className={styles.form} onSubmit={handleSubmit}>
            <p className={styles.replyHint}>
              Replies go to the email on your TradingAgents account
              {signedInEmail ? ` (signed in as ${signedInEmail})` : ""}.
            </p>

            <label className={styles.field}>
              <span className={styles.label}>Category (optional)</span>
              <select
                className={styles.select}
                value={category}
                onChange={(event) =>
                  setCategory((event.target.value || "") as FeedbackCategory | "")
                }
                aria-label="Feedback category"
              >
                <option value="">Select…</option>
                {CATEGORY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <fieldset className={styles.ratingFieldset}>
              <legend className={styles.label}>Rating (optional)</legend>
              <div className={styles.ratingRow} role="radiogroup" aria-label="Rating">
                {([1, 2, 3, 4, 5] as const).map((value) => (
                  <label key={value} className={styles.ratingOption}>
                    <input
                      type="radio"
                      name="feedback-rating"
                      value={value}
                      checked={rating === value}
                      onChange={() => setRating(value)}
                    />
                    <span>{value}</span>
                  </label>
                ))}
              </div>
            </fieldset>

            <label className={styles.field}>
              <span className={styles.label}>Message</span>
              <textarea
                className={styles.textarea}
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                required
                maxLength={4000}
                rows={6}
                placeholder="What worked well? What should we improve?"
                aria-required="true"
              />
            </label>

            {error ? (
              <p className={styles.error} role="alert">
                {error}
              </p>
            ) : null}

            <div className={styles.actions}>
              <button
                type="button"
                className={styles.secondaryButton}
                onClick={onClose}
                disabled={submitting}
              >
                Cancel
              </button>
              <button
                type="submit"
                className={styles.primaryButton}
                disabled={submitting || !message.trim()}
                aria-busy={submitting}
              >
                {submitting ? "Sending…" : "Send feedback"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
