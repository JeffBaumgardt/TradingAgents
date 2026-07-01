/**
 * @file apps/web/src/lib/session-display.ts
 * Shared session formatting helpers for server and client components.
 */

import type { Session } from "@tradingagents/api-types";

export function formatSessionDate(analysisDate: string): string {
  const [year, month, day] = analysisDate.split("-").map(Number);
  if (!year || !month || !day) {
    return analysisDate;
  }
  return new Date(year, month - 1, day).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function sessionStatusLabel(status: Session["status"]): string {
  switch (status) {
    case "completed":
      return "Completed";
    case "running":
      return "Running";
    case "error":
      return "Failed";
    case "cancelled":
      return "Cancelled";
    default:
      return "Pending";
  }
}

/** CSS module suffix for status color (maps to RecentSessions.module.css). */
export function sessionStatusClassSuffix(status: Session["status"]): string {
  switch (status) {
    case "completed":
      return "statusCompleted";
    case "running":
      return "statusRunning";
    case "error":
      return "statusError";
    default:
      return "statusOther";
  }
}
