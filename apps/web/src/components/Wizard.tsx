/**
 * @file apps/web/src/components/Wizard.tsx
 * Multi-step configuration wizard for starting a new analysis run.
 * Product always uses Agents Model; user chooses research depth + efficiency.
 */

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type {
  AnalystType,
  ConfigOptions,
  CreateSessionRequest,
  ResearchDepth,
} from "@tradingagents/api-types";
import {
  AGENTS_MODEL_DISPLAY_NAME,
  AGENTS_MODEL_ID,
  AGENTS_MODEL_PROVIDER_ID,
} from "@tradingagents/api-types";
import {
  normalizeTickerSymbol,
  todayIsoDate,
  validateAnalysisDateForWizard,
} from "@tradingagents/utils";
import {
  ApiClientError,
  createSession,
  fetchConfigOptions,
} from "@/lib/api-client";
import styles from "./Wizard.module.css";

const TOTAL_STEPS = 6;

const STEP_TITLES: Record<number, string> = {
  1: "Choose a ticker",
  2: "Add your investing context",
  3: "Pick the analysis date",
  4: "Select analyst agents",
  5: "Set research depth",
  6: "Set efficiency",
};

const STEP_DESCRIPTIONS: Record<number, string> = {
  1: "Enter the stock or ETF symbol you want the agents to analyze.",
  2: "Tell the agents about your situation so recommendations fit your goals. Leave this blank if you only want a general market analysis.",
  3: "Agents will use market data available on or before this date.",
  4: "Each analyst focuses on a different angle — market trends, news, sentiment, or fundamentals.",
  5: "Higher depth runs more debate rounds between agents. Deeper runs take longer and use more credits.",
  6: "Efficiency controls how hard the Agents Model thinks. Lower is faster and uses fewer credits.",
};

interface WizardFormState {
  ticker: string;
  userContext: string;
  analysisDate: string;
  analysts: AnalystType[];
  researchDepth: ResearchDepth;
  anthropicEffort: "low" | "medium" | "high";
}

const DEFAULT_FORM: WizardFormState = {
  ticker: "SPY",
  userContext: "",
  analysisDate: todayIsoDate(),
  analysts: ["market"],
  researchDepth: 1,
  anthropicEffort: "high",
};

export default function Wizard() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<WizardFormState>(DEFAULT_FORM);
  const [options, setOptions] = useState<ConfigOptions | null>(null);
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoadingOptions(true);
      try {
        const next = await fetchConfigOptions();
        if (cancelled) return;
        setOptions(next);
        setForm((prev) => ({
          ...prev,
          researchDepth: (next.researchDepths[1]?.value as ResearchDepth) ?? 3,
        }));
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof ApiClientError ? err.message : "Failed to load options.");
        }
      } finally {
        if (!cancelled) setLoadingOptions(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  function patchForm(partial: Partial<WizardFormState>) {
    setForm((prev) => ({ ...prev, ...partial }));
  }

  function toggleAnalyst(value: string) {
    const analyst = value as AnalystType;
    setForm((prev) => {
      const has = prev.analysts.includes(analyst);
      if (has && prev.analysts.length === 1) {
        return prev;
      }
      return {
        ...prev,
        analysts: has
          ? prev.analysts.filter((a) => a !== analyst)
          : [...prev.analysts, analyst],
      };
    });
  }

  function validateCurrentStep(): boolean {
    setFieldError(null);
    if (step === 1) {
      if (!normalizeTickerSymbol(form.ticker)) {
        setFieldError("Enter a valid ticker symbol.");
        return false;
      }
    }
    if (step === 3) {
      const dateError = validateAnalysisDateForWizard(form.analysisDate.trim());
      if (dateError) {
        setFieldError(dateError);
        return false;
      }
    }
    if (step === 4 && form.analysts.length === 0) {
      setFieldError("Select at least one analyst.");
      return false;
    }
    return true;
  }

  function goToStep(nextStep: number) {
    setFieldError(null);
    setStep(nextStep);
  }

  function handleNext() {
    if (!validateCurrentStep()) return;
    if (step < TOTAL_STEPS) {
      goToStep(step + 1);
    } else {
      void handleSubmit();
    }
  }

  function handleBack() {
    setFieldError(null);
    setStep((s) => Math.max(1, s - 1));
  }

  function handleSkipContext() {
    patchForm({ userContext: "" });
    goToStep(3);
  }

  async function handleSubmit() {
    if (!validateCurrentStep()) return;

    const payload: CreateSessionRequest = {
      ticker: normalizeTickerSymbol(form.ticker),
      userContext: form.userContext.trim() || undefined,
      analysisDate: form.analysisDate.trim(),
      outputLanguage: "English",
      analysts: form.analysts,
      researchDepth: form.researchDepth,
      llmProvider: AGENTS_MODEL_PROVIDER_ID,
      thinkLlm: AGENTS_MODEL_ID,
      anthropicEffort: form.anthropicEffort,
    };

    setSubmitting(true);
    setError(null);
    try {
      const session = await createSession(payload);
      router.push(`/run/${session.id}`);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to create session.");
      setSubmitting(false);
    }
  }

  const primaryButtonLabel =
    step === TOTAL_STEPS
      ? submitting
        ? "Starting analysis…"
        : "Start analysis run"
      : "Continue to next step";

  if (loadingOptions || !options) {
    return (
      <div className={styles.panel}>
        {error ? (
          <p className="error" role="alert">
            {error}
          </p>
        ) : (
          <p className={styles.hint} aria-live="polite">
            Loading analysis options…
          </p>
        )}
      </div>
    );
  }

  return (
    <div className={styles.panel}>
      <header className={styles.header}>
        <p className={styles.stepMeta}>
          Step {step} of {TOTAL_STEPS}
        </p>
        <h3 className={styles.stepTitle}>{STEP_TITLES[step]}</h3>
        <p className={styles.stepDescription}>{STEP_DESCRIPTIONS[step]}</p>
        <p className={styles.hint}>
          Runs use <strong>{AGENTS_MODEL_DISPLAY_NAME}</strong> ({AGENTS_MODEL_ID}) —
          included on every Standard and Pro plan.
        </p>
      </header>

      <div className={styles.body}>
        {step === 1 && (
          <div className={styles.field}>
            <label htmlFor="ticker">Ticker</label>
            <input
              id="ticker"
              value={form.ticker}
              onChange={(e) => patchForm({ ticker: e.target.value.toUpperCase() })}
              autoComplete="off"
              spellCheck={false}
              aria-label="Stock or ETF ticker symbol"
            />
          </div>
        )}

        {step === 2 && (
          <div className={styles.field}>
            <label htmlFor="userContext">Investing context (optional)</label>
            <textarea
              id="userContext"
              rows={5}
              value={form.userContext}
              onChange={(e) => patchForm({ userContext: e.target.value })}
              placeholder="e.g. Long-term holder looking for entry points on pullbacks…"
              aria-label="Optional investing context for the agents"
            />
          </div>
        )}

        {step === 3 && (
          <div className={styles.field}>
            <label htmlFor="analysisDate">Analysis date</label>
            <input
              id="analysisDate"
              type="date"
              value={form.analysisDate}
              max={todayIsoDate()}
              onChange={(e) => patchForm({ analysisDate: e.target.value })}
              aria-label="Analysis date"
            />
          </div>
        )}

        {step === 4 && (
          <fieldset className={styles.field}>
            <legend>Analysts</legend>
            {(options.analysts ?? []).map((analyst) => (
              <label key={analyst.value} className={styles.checkboxRow}>
                <input
                  type="checkbox"
                  checked={form.analysts.includes(analyst.value as AnalystType)}
                  onChange={() => toggleAnalyst(analyst.value)}
                />
                <span>
                  {analyst.label}
                  <span className={styles.checkboxHint}>
                    {analyst.value === "market" && "Price action, indicators, and technical outlook"}
                    {analyst.value === "social" && "Social media sentiment and retail buzz"}
                    {analyst.value === "news" && "Headlines, macro events, and company news"}
                    {analyst.value === "fundamentals" && "Financials, valuation, and business quality"}
                  </span>
                </span>
              </label>
            ))}
          </fieldset>
        )}

        {step === 5 && (
          <div className={styles.field}>
            <label htmlFor="researchDepth">Research depth</label>
            <select
              id="researchDepth"
              value={form.researchDepth}
              onChange={(e) =>
                patchForm({ researchDepth: Number(e.target.value) as ResearchDepth })
              }
              aria-describedby="research-depth-hint"
            >
              {options.researchDepths.map((depth) => (
                <option key={depth.value} value={depth.value}>
                  {depth.label}
                </option>
              ))}
            </select>
            <p id="research-depth-hint" className={styles.hint}>
              More depth means more back-and-forth debate between bull and bear researchers before
              the final decision.
            </p>
          </div>
        )}

        {step === 6 && (
          <div className={styles.field}>
            <label htmlFor="efficiency">Efficiency</label>
            <select
              id="efficiency"
              value={form.anthropicEffort}
              onChange={(e) =>
                patchForm({
                  anthropicEffort: e.target.value as "low" | "medium" | "high",
                })
              }
              aria-describedby="efficiency-hint"
            >
              <option value="high">High (recommended — deeper reasoning)</option>
              <option value="medium">Medium (balanced)</option>
              <option value="low">Low (faster, fewer credits)</option>
            </select>
            <p id="efficiency-hint" className={styles.hint}>
              Controls how thoroughly the Agents Model reasons. Higher efficiency quality uses more
              compute credits.
            </p>
          </div>
        )}

        {fieldError && (
          <p className="error" role="alert">
            {fieldError}
          </p>
        )}
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
      </div>

      <div className={styles.actions}>
        <button
          type="button"
          className={styles.button}
          onClick={handleBack}
          disabled={step === 1 || submitting}
          aria-label="Go back to the previous setup step"
        >
          Back
        </button>
        <div className={styles.actionGroup}>
          {step === 2 && (
            <button
              type="button"
              className={styles.buttonGhost}
              onClick={handleSkipContext}
              disabled={submitting}
              aria-label="Skip optional context and continue with a general market analysis"
            >
              Skip — use general analysis
            </button>
          )}
          <button
            type="button"
            className={styles.buttonPrimary}
            onClick={handleNext}
            disabled={submitting}
            aria-label={primaryButtonLabel}
          >
            {primaryButtonLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
