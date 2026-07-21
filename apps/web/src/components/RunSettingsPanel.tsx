/**
 * @file apps/web/src/components/RunSettingsPanel.tsx
 * Collapsible summary of wizard inputs for an analysis run.
 */

"use client";

import type { KeyboardEvent } from "react";
import type { CreateSessionRequest, ResearchDepth, Session } from "@tradingagents/api-types";
import { ANALYST_AGENT_NAMES, resolveThinkLlm } from "@tradingagents/api-types";
import styles from "./RunSettingsPanel.module.css";

const RESEARCH_DEPTH_LABELS: Record<ResearchDepth, string> = {
  1: "Shallow — quick research, fewer debate rounds",
  3: "Medium — balanced research and debate",
  5: "Deep — comprehensive research and debate",
};

function formatAnalysisDate(dateStr: string): string {
  const [year, month, day] = dateStr.split("-").map(Number);
  if (!year || !month || !day) {
    return dateStr;
  }
  return new Date(year, month - 1, day).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function formatProviderLabel(provider: string): string {
  const labels: Record<string, string> = {
    openai: "OpenAI",
    google: "Google",
    anthropic: "Anthropic",
    xai: "xAI",
  };
  return labels[provider.toLowerCase()] ?? provider;
}

function providerConfigRows(config: CreateSessionRequest): { label: string; value: string }[] {
  const rows: { label: string; value: string }[] = [];

  if (config.googleThinkingLevel) {
    rows.push({
      label: "Gemini thinking",
      value: config.googleThinkingLevel === "high" ? "Enabled" : "Minimal",
    });
  }
  if (config.openaiReasoningEffort) {
    rows.push({
      label: "OpenAI reasoning effort",
      value: config.openaiReasoningEffort,
    });
  }
  if (config.anthropicEffort) {
    rows.push({
      label: "Claude effort",
      value: config.anthropicEffort,
    });
  }

  return rows;
}

interface RunSettingsPanelProps {
  session: Session | null;
  expanded: boolean;
  onToggle: () => void;
}

export default function RunSettingsPanel({
  session,
  expanded,
  onToggle,
}: RunSettingsPanelProps) {
  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onToggle();
    }
  }

  if (!session) {
    return (
      <section className={styles.panel}>
        <p className="muted">Loading run settings…</p>
      </section>
    );
  }

  const { config } = session;
  const analystLabels = config.analysts.map((analyst) => ANALYST_AGENT_NAMES[analyst]);
  const extraProviderRows = providerConfigRows(config);

  return (
    <section className={styles.panel}>
      <button
        type="button"
        className={styles.toggle}
        aria-expanded={expanded}
        aria-controls="run-settings"
        onClick={onToggle}
        onKeyDown={handleKeyDown}
      >
        <span className={styles.toggleLabel}>
          <span
            className={`${styles.chevron} ${expanded ? styles.chevronOpen : ""}`}
            aria-hidden
          >
            ›
          </span>
          Run configuration
        </span>
        <span className={styles.summary}>
          {session.ticker} · {formatAnalysisDate(session.analysisDate)}
        </span>
      </button>

      {expanded && (
        <dl id="run-settings" className={styles.details}>
          <div className={styles.row}>
            <dt>Ticker</dt>
            <dd>{session.ticker}</dd>
          </div>
          <div className={styles.row}>
            <dt>Analysis date</dt>
            <dd>{formatAnalysisDate(session.analysisDate)}</dd>
          </div>
          {config.userContext?.trim() ? (
            <div className={styles.row}>
              <dt>Your context</dt>
              <dd className={styles.multiline}>{config.userContext.trim()}</dd>
            </div>
          ) : (
            <div className={styles.row}>
              <dt>Your context</dt>
              <dd className="muted">None — general market analysis</dd>
            </div>
          )}
          <div className={styles.row}>
            <dt>Analysts</dt>
            <dd>{analystLabels.join(", ")}</dd>
          </div>
          <div className={styles.row}>
            <dt>Research depth</dt>
            <dd>{RESEARCH_DEPTH_LABELS[config.researchDepth]}</dd>
          </div>
          <div className={styles.row}>
            <dt>LLM provider</dt>
            <dd>{formatProviderLabel(config.llmProvider)}</dd>
          </div>
          <div className={styles.row}>
            <dt>Model</dt>
            <dd>{resolveThinkLlm(config) || "—"}</dd>
          </div>
          {extraProviderRows.map((row) => (
            <div key={row.label} className={styles.row}>
              <dt>{row.label}</dt>
              <dd>{row.value}</dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  );
}
