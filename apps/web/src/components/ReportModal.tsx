/**
 * @file apps/web/src/components/ReportModal.tsx
 * Large scrollable modal for reading a full agent report.
 */

"use client";

import {
  useEffect,
  useId,
  useRef,
  type KeyboardEvent,
  type MouseEvent,
} from "react";
import MarkdownReport from "@/components/MarkdownReport";
import styles from "./ReportModal.module.css";

interface ReportModalProps {
  title: string;
  content: string;
  signal?: string | null;
  signalClassName?: string;
  onClose: () => void;
}

export default function ReportModal({
  title,
  content,
  signal,
  signalClassName,
  onClose,
}: ReportModalProps) {
  const titleId = useId();
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();

    function handleKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  function handleBackdropClick() {
    onClose();
  }

  function handleBackdropKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onClose();
    }
  }

  function handleDialogClick(event: MouseEvent<HTMLDivElement>) {
    event.stopPropagation();
  }

  return (
    <div
      className={styles.backdrop}
      role="presentation"
      onClick={handleBackdropClick}
      onKeyDown={handleBackdropKeyDown}
    >
      <div
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onClick={handleDialogClick}
      >
        <header className={styles.header}>
          <div className={styles.headerMain}>
            <h2 id={titleId} className={styles.title}>
              {title}
            </h2>
            {signal ? (
              <span
                className={`${styles.signal} ${signalClassName ?? ""}`}
                aria-label={`Signal: ${signal}`}
              >
                {signal}
              </span>
            ) : null}
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            className={styles.closeButton}
            onClick={onClose}
            aria-label={`Close ${title} report`}
          >
            Close
          </button>
        </header>
        <div className={styles.body}>
          <MarkdownReport content={content} />
        </div>
      </div>
    </div>
  );
}
