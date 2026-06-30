/**
 * @file packages/utils/src/index.ts
 * Shared utilities for TradingAgents frontend, API gateway, and tooling.
 */

import type { AnalystType, ResearchDepth } from "@tradingagents/api-types";

const TICKER_PATTERN = /^[A-Z0-9._^-]{1,32}$/i;
const ANALYST_VALUES = new Set<AnalystType>(["market", "social", "news", "fundamentals"]);
const RESEARCH_DEPTHS = new Set<ResearchDepth>([1, 3, 5]);

/** Normalize ticker input while preserving exchange suffixes. */
export function normalizeTicker(ticker: string): string {
  return ticker.trim().toUpperCase();
}

/** Alias for web wizard usage. */
export const normalizeTickerSymbol = normalizeTicker;

/** Validate ticker format used by the API gateway. */
export function validateTicker(ticker: string): boolean {
  const normalized = normalizeTicker(ticker);
  return normalized.length > 0 && TICKER_PATTERN.test(normalized);
}

/** Validate YYYY-MM-DD format (no future-date check). */
export function validateAnalysisDate(dateStr: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr.trim())) {
    return false;
  }
  const [year, month, day] = dateStr.split("-").map(Number);
  const parsed = new Date(year, month - 1, day);
  return (
    parsed.getFullYear() === year &&
    parsed.getMonth() === month - 1 &&
    parsed.getDate() === day
  );
}

/** Validate YYYY-MM-DD and ensure date is not in the future (web wizard). */
export function validateAnalysisDateForWizard(dateStr: string): string | null {
  const trimmed = dateStr.trim();
  if (!validateAnalysisDate(trimmed)) {
    return "Please enter a valid date in YYYY-MM-DD format.";
  }

  const [year, month, day] = trimmed.split("-").map(Number);
  const parsed = new Date(year, month - 1, day);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (parsed > today) {
    return "Analysis date cannot be in the future.";
  }

  return null;
}

export function validateAnalysts(analysts: string[]): analysts is AnalystType[] {
  return analysts.length > 0 && analysts.every((a) => ANALYST_VALUES.has(a as AnalystType));
}

export function validateResearchDepth(depth: number): depth is ResearchDepth {
  return RESEARCH_DEPTHS.has(depth as ResearchDepth);
}

/** Format today's date as YYYY-MM-DD. */
export function todayIsoDate(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** Format token counts for display (mirrors CLI). */
export function formatTokens(count: number): string {
  if (count >= 1000) {
    return `${(count / 1000).toFixed(1)}k`;
  }
  return String(count);
}

/** Format elapsed seconds as mm:ss. */
export function formatElapsed(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${String(secs).padStart(2, "0")}`;
}

/** Truncate long strings for feed display. */
export function truncateText(text: string, maxLength = 200): string {
  if (text.length <= maxLength) {
    return text;
  }
  return `${text.slice(0, maxLength - 3)}...`;
}

/** Format tool args for display (mirrors CLI). */
export function formatToolArgs(args: Record<string, unknown>, maxLength = 80): string {
  const result = JSON.stringify(args);
  if (result.length <= maxLength) {
    return result;
  }
  return `${result.slice(0, maxLength - 3)}...`;
}

/** Format a single SSE frame. */
export function formatSseEvent(eventType: string, data: Record<string, unknown>): string {
  return `event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`;
}

export {
  extractLabeledSignal,
  extractReportSignal,
  getReportSignalTone,
  type ReportSignal,
  type ReportSignalTone,
} from "./report-signal";

/** Providers that show step 9 provider-specific config. */
export const PROVIDERS_WITH_STEP9 = new Set(["google", "openai", "anthropic"]);

type ModelCapabilityKey =
  | "anthropicEffort"
  | "openaiReasoningEffort"
  | "googleThinkingLevel";

interface ModelWithCapabilities {
  id: string;
  capabilities?: Partial<Record<ModelCapabilityKey, boolean>>;
}

/** Resolve whether a selected catalog model advertises a provider capability. */
export function modelSupportsCapability(
  models: ModelWithCapabilities[],
  selectedId: string,
  customId: string,
  capability: ModelCapabilityKey,
): boolean {
  if (selectedId === "custom") {
    return false;
  }
  const resolvedId = selectedId === "custom" ? customId.trim() : selectedId;
  if (!resolvedId) {
    return false;
  }
  const model = models.find((item) => item.id === resolvedId);
  return model?.capabilities?.[capability] === true;
}

/** Whether step 9 should appear for the current provider and model picks. */
export function shouldShowProviderConfigStep(
  provider: string,
  quickModels: ModelWithCapabilities[],
  deepModels: ModelWithCapabilities[],
  quickSelectedId: string,
  deepSelectedId: string,
  customQuickModel: string,
  customDeepModel: string,
): boolean {
  const providerKey = provider.toLowerCase();
  if (!PROVIDERS_WITH_STEP9.has(providerKey)) {
    return false;
  }

  if (providerKey === "google") {
    return (
      modelSupportsCapability(
        quickModels,
        quickSelectedId,
        customQuickModel,
        "googleThinkingLevel",
      ) ||
      modelSupportsCapability(
        deepModels,
        deepSelectedId,
        customDeepModel,
        "googleThinkingLevel",
      )
    );
  }

  if (providerKey === "openai") {
    return (
      modelSupportsCapability(
        quickModels,
        quickSelectedId,
        customQuickModel,
        "openaiReasoningEffort",
      ) ||
      modelSupportsCapability(
        deepModels,
        deepSelectedId,
        customDeepModel,
        "openaiReasoningEffort",
      )
    );
  }

  if (providerKey === "anthropic") {
    return (
      modelSupportsCapability(
        quickModels,
        quickSelectedId,
        customQuickModel,
        "anthropicEffort",
      ) ||
      modelSupportsCapability(
        deepModels,
        deepSelectedId,
        customDeepModel,
        "anthropicEffort",
      )
    );
  }

  return false;
}
