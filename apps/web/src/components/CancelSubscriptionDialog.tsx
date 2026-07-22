/**
 * @file apps/web/src/components/CancelSubscriptionDialog.tsx
 * Simple confirmation dialog for scheduling subscription cancellation.
 * No dark patterns — short copy, confirm / keep plan only.
 */

"use client";

import {
  useEffect,
  useId,
  useRef,
  type KeyboardEvent,
  type MouseEvent,
} from "react";
import { formatPeriodEnd } from "@/lib/billing-display";
import styles from "./CancelSubscriptionDialog.module.css";

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

interface CancelSubscriptionDialogProps {
  open: boolean;
  periodEnd: string | null;
  submitting: boolean;
  error: string | null;
  onClose: () => void;
  onConfirm: () => void;
}

export default function CancelSubscriptionDialog({
  open,
  periodEnd,
  submitting,
  error,
  onClose,
  onConfirm,
}: CancelSubscriptionDialogProps) {
  const titleId = useId();
  const descriptionId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const keepButtonRef = useRef<HTMLButtonElement>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);
  const previousOverflowRef = useRef<string | null>(null);
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
    // Focus the safe default (keep plan), not the destructive confirm.
    keepButtonRef.current?.focus();

    function handleKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape" && !submitting) {
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

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflowRef.current ?? "";
      previouslyFocusedRef.current?.focus();
    };
  }, [open, submitting]);

  if (!open) {
    return null;
  }

  function handleBackdropClick(event: MouseEvent<HTMLDivElement>) {
    if (event.target === event.currentTarget && !submitting) {
      onClose();
    }
  }

  function handleBackdropKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape" && !submitting) {
      onClose();
    }
  }

  const endsLabel = periodEnd ? formatPeriodEnd(periodEnd) : "the end of your billing period";

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
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        tabIndex={-1}
      >
        <h2 id={titleId} className={styles.title}>
          Cancel subscription?
        </h2>
        <div id={descriptionId} className={styles.body}>
          <p>
            Billing stops after <strong>{endsLabel}</strong>. You will not be charged
            again for this plan.
          </p>
          <p>
            Existing analyses and any shared links keep working. You can still read
            your reports anytime — you just will not be able to start new ones unless
            you subscribe again.
          </p>
        </div>
        {error ? (
          <p className={styles.error} role="alert">
            {error}
          </p>
        ) : null}
        <div className={styles.actions}>
          <button
            ref={keepButtonRef}
            type="button"
            className={styles.keepButton}
            onClick={onClose}
            disabled={submitting}
            aria-label="Keep subscription"
          >
            Keep plan
          </button>
          <button
            type="button"
            className={styles.confirmButton}
            onClick={onConfirm}
            disabled={submitting}
            aria-label="Confirm cancel subscription"
          >
            {submitting ? "Canceling…" : "Cancel subscription"}
          </button>
        </div>
      </div>
    </div>
  );
}
