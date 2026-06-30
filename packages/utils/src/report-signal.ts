/**
 * @file packages/utils/src/report-signal.ts
 * Extract structured Buy/Hold/Sell (and 5-tier) signals from report markdown.
 */

import type { ReportSectionKey } from "@tradingagents/api-types";

export type ReportSignal =
  | "Buy"
  | "Overweight"
  | "Hold"
  | "Underweight"
  | "Sell";

const RATINGS_5_TIER = new Set<ReportSignal>([
  "Buy",
  "Overweight",
  "Hold",
  "Underweight",
  "Sell",
]);

const TRADER_ACTIONS = new Set<ReportSignal>(["Buy", "Hold", "Sell"]);

function normalizeSignalWord(word: string): ReportSignal | null {
  const cleaned = word.replace(/[*:.,]/g, "").trim();
  if (!cleaned) {
    return null;
  }
  const title = cleaned.charAt(0).toUpperCase() + cleaned.slice(1).toLowerCase();
  if (RATINGS_5_TIER.has(title as ReportSignal)) {
    return title as ReportSignal;
  }
  return null;
}

/** Read a labeled field such as ``**Rating**: Hold`` from report markdown. */
export function extractLabeledSignal(content: string, label: string): ReportSignal | null {
  const labelPattern = new RegExp(
    `\\*\\*${label}\\*\\*\\s*[:\\-]\\s*([\\w*]+)`,
    "i",
  );
  const match = content.match(labelPattern);
  if (match) {
    return normalizeSignalWord(match[1]);
  }
  return null;
}

/** Extract the actionable signal for a report section, when one exists. */
export function extractReportSignal(
  section: ReportSectionKey,
  content: string,
): ReportSignal | null {
  if (!content.trim()) {
    return null;
  }

  if (section === "investment_plan") {
    return extractLabeledSignal(content, "Recommendation");
  }

  if (section === "trader_investment_plan") {
    const action = extractLabeledSignal(content, "Action");
    if (action && TRADER_ACTIONS.has(action)) {
      return action;
    }

    const finalMatch = content.match(
      /FINAL TRANSACTION PROPOSAL:\s*\*\*(\w+)\*\*/i,
    );
    if (finalMatch) {
      const normalized = normalizeSignalWord(finalMatch[1]);
      if (normalized && TRADER_ACTIONS.has(normalized)) {
        return normalized;
      }
    }
    return null;
  }

  if (section === "final_trade_decision") {
    return extractLabeledSignal(content, "Rating");
  }

  return null;
}

export type ReportSignalTone = "bullish" | "neutral" | "bearish";

/** Map a rating to a coarse tone for badge styling. */
export function getReportSignalTone(signal: ReportSignal): ReportSignalTone {
  if (signal === "Buy" || signal === "Overweight") {
    return "bullish";
  }
  if (signal === "Sell" || signal === "Underweight") {
    return "bearish";
  }
  return "neutral";
}
