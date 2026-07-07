/**
 * @file apps/web/src/components/AgentProgressCard.tsx
 * Single agent status card with optional live output preview.
 */

"use client";

import { useState, type KeyboardEvent } from "react";
import type { AgentStatusValue } from "@tradingagents/api-types";
import styles from "./AgentProgressCard.module.css";

interface AgentProgressCardProps {
  agent: string;
  team: string;
  status: AgentStatusValue;
  isActive: boolean;
  compact?: boolean;
  previewContent?: string | null;
}

function statusLabel(status: AgentStatusValue): string {
  switch (status) {
    case "pending":
      return "Waiting";
    case "in_progress":
      return "Working";
    case "completed":
      return "Done";
    case "error":
      return "Failed";
    case "cancelled":
      return "Skipped";
    default:
      return status;
  }
}

function statusToneClass(status: AgentStatusValue): string {
  switch (status) {
    case "in_progress":
      return styles.statusInProgress;
    case "completed":
      return styles.statusCompleted;
    case "error":
      return styles.statusError;
    case "cancelled":
      return styles.statusCancelled;
    default:
      return styles.statusPending;
  }
}

export default function AgentProgressCard({
  agent,
  team,
  status,
  isActive,
  compact = false,
  previewContent,
}: AgentProgressCardProps) {
  const [expanded, setExpanded] = useState(false);
  const canExpand = Boolean(previewContent) && !compact;

  function handleToggleExpand() {
    if (!canExpand) {
      return;
    }
    setExpanded((prev) => !prev);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      handleToggleExpand();
    }
  }

  return (
    <article
      className={`${styles.card} ${compact ? styles.cardCompact : ""} ${
        isActive ? styles.cardActive : ""
      } ${status === "completed" ? styles.cardDone : ""}`}
      aria-label={`${agent} — ${statusLabel(status)}`}
    >
      <div className={styles.cardHeader}>
        <div className={styles.cardIdentity}>
          {!compact ? <span className={styles.teamTag}>{team}</span> : null}
          <h3 className={styles.agentName}>{agent}</h3>
        </div>
        <span className={`${styles.statusBadge} ${statusToneClass(status)}`}>
          {status === "in_progress" ? (
            <>
              <span className={styles.pulseDot} aria-hidden />
              {statusLabel(status)}
            </>
          ) : (
            statusLabel(status)
          )}
        </span>
      </div>

      {canExpand ? (
        <>
          <button
            type="button"
            className={styles.expandButton}
            aria-expanded={expanded}
            onClick={handleToggleExpand}
            onKeyDown={handleKeyDown}
          >
            {expanded ? "Hide output" : "Peek at output"}
          </button>
          {expanded ? (
            <pre className={styles.preview}>{previewContent}</pre>
          ) : (
            <p className={styles.previewHint}>
              {status === "in_progress" ? "Streaming live…" : "Output available"}
            </p>
          )}
        </>
      ) : null}

      {!compact && status === "pending" ? (
        <p className={styles.waitingHint}>Queued — starts when prior agents finish</p>
      ) : null}
    </article>
  );
}
