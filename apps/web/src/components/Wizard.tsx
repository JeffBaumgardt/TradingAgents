/**
 * @file apps/web/src/components/Wizard.tsx
 * Multi-step configuration wizard mirroring CLI steps (language fixed to English).
 */

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type {
  AnalystType,
  CreateSessionRequest,
  ResearchDepth,
} from "@tradingagents/api-types";
import {
  normalizeTickerSymbol,
  shouldShowProviderConfigStep,
  todayIsoDate,
  validateAnalysisDateForWizard,
} from "@tradingagents/utils";
import {
  ApiClientError,
  createSession,
  fetchProviderModels,
} from "@/lib/api-client";
import { useUserSession } from "@/context/UserSessionContext";
import styles from "./Wizard.module.css";

const TOTAL_STEPS = 8;

const STEP_TITLES: Record<number, string> = {
  1: "Ticker Symbol",
  2: "Your Context",
  3: "Analysis Date",
  4: "Analysts Team",
  5: "Research Depth",
  6: "LLM Provider",
  7: "Thinking Agents",
  8: "Provider Configuration",
};

interface WizardFormState {
  ticker: string;
  userContext: string;
  analysisDate: string;
  analysts: AnalystType[];
  researchDepth: ResearchDepth;
  llmProvider: string;
  backendUrl: string | null;
  quickThinkLlm: string;
  deepThinkLlm: string;
  customQuickModel: string;
  customDeepModel: string;
  googleThinkingLevel: "high" | "minimal" | "";
  openaiReasoningEffort: "low" | "medium" | "high" | "";
  anthropicEffort: "low" | "medium" | "high" | "";
}

const DEFAULT_FORM: WizardFormState = {
  ticker: "SPY",
  userContext: "",
  analysisDate: todayIsoDate(),
  analysts: ["market"],
  researchDepth: 1,
  llmProvider: "openai",
  backendUrl: null,
  quickThinkLlm: "",
  deepThinkLlm: "",
  customQuickModel: "",
  customDeepModel: "",
  googleThinkingLevel: "high",
  openaiReasoningEffort: "medium",
  anthropicEffort: "high",
};

function resolveModelId(selected: string, custom: string): string {
  if (selected === "custom") {
    return custom.trim();
  }
  return selected;
}

export default function Wizard() {
  const router = useRouter();
  const { resolvedConfig, providerCredentials } = useUserSession();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<WizardFormState>(DEFAULT_FORM);
  const options = resolvedConfig;
  const [quickModels, setQuickModels] = useState<{ id: string; label: string }[]>([]);
  const [deepModels, setDeepModels] = useState<{ id: string; label: string }[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);

  useEffect(() => {
    if (!options) {
      return;
    }
    setForm((prev) => ({
      ...prev,
      analysts: [options.analysts[0]?.value as AnalystType].filter(Boolean),
      researchDepth: options.researchDepths[1]?.value ?? 3,
      llmProvider: options.providers[0]?.id ?? prev.llmProvider,
      backendUrl: options.providers[0]?.backendUrl ?? null,
    }));
  }, [options]);

  const loadModels = useCallback(
    async (provider: string) => {
      setLoadingModels(true);
      try {
        const [quick, deep] = await Promise.all([
          fetchProviderModels(provider, "quick", providerCredentials),
          fetchProviderModels(provider, "deep", providerCredentials),
        ]);
        setQuickModels(quick.models);
        setDeepModels(deep.models);
        setForm((prev) => ({
          ...prev,
          quickThinkLlm: quick.models[0]?.id ?? "",
          deepThinkLlm: deep.models[0]?.id ?? "",
        }));
      } catch (err) {
        setError(
          err instanceof ApiClientError ? err.message : "Failed to load model options.",
        );
      } finally {
        setLoadingModels(false);
      }
    },
    [providerCredentials],
  );

  useEffect(() => {
    if (step === 7 && form.llmProvider) {
      void loadModels(form.llmProvider);
    }
  }, [step, form.llmProvider, loadModels]);

  const showProviderConfig = useMemo(
    () =>
      shouldShowProviderConfigStep(
        form.llmProvider,
        quickModels,
        deepModels,
        form.quickThinkLlm,
        form.deepThinkLlm,
        form.customQuickModel,
        form.customDeepModel,
      ),
    [
      form.llmProvider,
      form.quickThinkLlm,
      form.deepThinkLlm,
      form.customQuickModel,
      form.customDeepModel,
      quickModels,
      deepModels,
    ],
  );
  const effectiveTotalSteps = showProviderConfig ? TOTAL_STEPS : 7;

  function patchForm(partial: Partial<WizardFormState>) {
    setForm((prev) => ({ ...prev, ...partial }));
    setFieldError(null);
  }

  function toggleAnalyst(value: AnalystType) {
    setForm((prev) => {
      const exists = prev.analysts.includes(value);
      const next = exists
        ? prev.analysts.filter((a) => a !== value)
        : [...prev.analysts, value];
      return { ...prev, analysts: next };
    });
    setFieldError(null);
  }

  function validateCurrentStep(): boolean {
    if (step === 1) {
      if (!form.ticker.trim()) {
        setFieldError("Please enter a ticker symbol.");
        return false;
      }
    }
    if (step === 3) {
      const dateError = validateAnalysisDateForWizard(form.analysisDate);
      if (dateError) {
        setFieldError(dateError);
        return false;
      }
    }
    if (step === 4 && form.analysts.length === 0) {
      setFieldError("Select at least one analyst.");
      return false;
    }
    if (step === 7) {
      const quick = resolveModelId(form.quickThinkLlm, form.customQuickModel);
      const deep = resolveModelId(form.deepThinkLlm, form.customDeepModel);
      if (!quick || !deep) {
        setFieldError("Select or enter both quick and deep thinking models.");
        return false;
      }
    }
    return true;
  }

  function handleNext() {
    if (!validateCurrentStep()) {
      return;
    }
    if (step === 7 && !showProviderConfig) {
      void handleSubmit();
      return;
    }
    if (step < effectiveTotalSteps) {
      setStep((s) => s + 1);
    } else {
      void handleSubmit();
    }
  }

  function handleBack() {
    setFieldError(null);
    setStep((s) => Math.max(1, s - 1));
  }

  async function handleSubmit() {
    if (!validateCurrentStep()) {
      return;
    }

    const payload: CreateSessionRequest = {
      ticker: normalizeTickerSymbol(form.ticker),
      userContext: form.userContext.trim() || undefined,
      analysisDate: form.analysisDate.trim(),
      outputLanguage: "English",
      analysts: form.analysts,
      researchDepth: form.researchDepth,
      llmProvider: form.llmProvider,
      backendUrl: form.backendUrl,
      quickThinkLlm: resolveModelId(form.quickThinkLlm, form.customQuickModel),
      deepThinkLlm: resolveModelId(form.deepThinkLlm, form.customDeepModel),
      providerCredentials,
    };

    if (form.llmProvider === "google" && showProviderConfig && form.googleThinkingLevel) {
      payload.googleThinkingLevel = form.googleThinkingLevel;
    }
    if (form.llmProvider === "openai" && showProviderConfig && form.openaiReasoningEffort) {
      payload.openaiReasoningEffort = form.openaiReasoningEffort;
    }
    if (form.llmProvider === "anthropic" && showProviderConfig && form.anthropicEffort) {
      payload.anthropicEffort = form.anthropicEffort;
    }

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

  if (!options) {
    return (
      <div className={styles.panel}>
        <p className="error">No provider credentials configured. Go back and add API keys.</p>
      </div>
    );
  }

  if (options.providers.length === 0) {
    return (
      <div className={styles.panel}>
        <p className="error">No LLM providers available with your current credentials.</p>
      </div>
    );
  }

  return (
    <div className={styles.wizard}>
      <div className={styles.stepHeader}>
        <h1 className={styles.stepTitle}>
          Step {step}: {STEP_TITLES[step]}
        </h1>
        <span className={styles.stepIndicator}>
          {step} / {effectiveTotalSteps}
        </span>
      </div>

      <div className={styles.panel}>
        {step === 1 && (
          <div className={styles.field}>
            <label htmlFor="ticker">Ticker symbol</label>
            <input
              id="ticker"
              value={form.ticker}
              onChange={(e) => patchForm({ ticker: e.target.value })}
              placeholder="SPY"
            />
            <p className={styles.hint}>
              Examples: SPY, CNC.TO, 7203.T, 0700.HK
            </p>
          </div>
        )}

        {step === 2 && (
          <div className={styles.field}>
            <label htmlFor="userContext">Your context (optional)</label>
            <textarea
              id="userContext"
              rows={6}
              value={form.userContext}
              onChange={(e) => patchForm({ userContext: e.target.value })}
              placeholder="Describe holdings, options questions, or time horizon…"
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
            />
          </div>
        )}

        {step === 4 && (
          <div className={styles.checkboxGroup}>
            {options.analysts.map((analyst) => (
              <label key={analyst.value} className={styles.checkboxRow}>
                <input
                  type="checkbox"
                  checked={form.analysts.includes(analyst.value as AnalystType)}
                  onChange={() => toggleAnalyst(analyst.value as AnalystType)}
                />
                {analyst.label}
              </label>
            ))}
          </div>
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
            >
              {options.researchDepths.map((depth) => (
                <option key={depth.value} value={depth.value}>
                  {depth.label}
                </option>
              ))}
            </select>
          </div>
        )}

        {step === 6 && (
          <div className={styles.field}>
            <label htmlFor="llmProvider">LLM provider</label>
            <select
              id="llmProvider"
              value={form.llmProvider}
              onChange={(e) => {
                const provider = options.providers.find((p) => p.id === e.target.value);
                patchForm({
                  llmProvider: e.target.value,
                  backendUrl: provider?.backendUrl ?? null,
                });
              }}
            >
              {options.providers.map((provider) => (
                <option key={provider.id} value={provider.id}>
                  {provider.label}
                </option>
              ))}
            </select>
          </div>
        )}

        {step === 7 && (
          <>
            {loadingModels ? (
              <p className={styles.hint}>Loading models…</p>
            ) : (
              <>
                <div className={styles.field}>
                  <label htmlFor="quickModel">Quick-thinking model</label>
                  <select
                    id="quickModel"
                    value={form.quickThinkLlm}
                    onChange={(e) => patchForm({ quickThinkLlm: e.target.value })}
                  >
                    {quickModels.map((model) => (
                      <option key={model.id} value={model.id}>
                        {model.label}
                      </option>
                    ))}
                  </select>
                  {form.quickThinkLlm === "custom" && (
                    <input
                      className={styles.customModelRow}
                      placeholder="Enter model ID"
                      value={form.customQuickModel}
                      onChange={(e) => patchForm({ customQuickModel: e.target.value })}
                    />
                  )}
                </div>
                <div className={styles.field}>
                  <label htmlFor="deepModel">Deep-thinking model</label>
                  <select
                    id="deepModel"
                    value={form.deepThinkLlm}
                    onChange={(e) => patchForm({ deepThinkLlm: e.target.value })}
                  >
                    {deepModels.map((model) => (
                      <option key={model.id} value={model.id}>
                        {model.label}
                      </option>
                    ))}
                  </select>
                  {form.deepThinkLlm === "custom" && (
                    <input
                      className={styles.customModelRow}
                      placeholder="Enter model ID"
                      value={form.customDeepModel}
                      onChange={(e) => patchForm({ customDeepModel: e.target.value })}
                    />
                  )}
                </div>
              </>
            )}
          </>
        )}

        {step === 8 && showProviderConfig && (
          <>
            {form.llmProvider === "google" && (
              <div className={styles.field}>
                <label htmlFor="geminiThinking">Gemini thinking mode</label>
                <select
                  id="geminiThinking"
                  value={form.googleThinkingLevel}
                  onChange={(e) =>
                    patchForm({
                      googleThinkingLevel: e.target.value as "high" | "minimal",
                    })
                  }
                >
                  <option value="high">Enable thinking (recommended)</option>
                  <option value="minimal">Minimal / disable thinking</option>
                </select>
              </div>
            )}
            {form.llmProvider === "openai" && (
              <div className={styles.field}>
                <label htmlFor="openaiEffort">OpenAI reasoning effort</label>
                <select
                  id="openaiEffort"
                  value={form.openaiReasoningEffort}
                  onChange={(e) =>
                    patchForm({
                      openaiReasoningEffort: e.target.value as "low" | "medium" | "high",
                    })
                  }
                >
                  <option value="medium">Medium (default)</option>
                  <option value="high">High (more thorough)</option>
                  <option value="low">Low (faster)</option>
                </select>
              </div>
            )}
            {form.llmProvider === "anthropic" && (
              <div className={styles.field}>
                <label htmlFor="anthropicEffort">Claude effort level</label>
                <select
                  id="anthropicEffort"
                  value={form.anthropicEffort}
                  onChange={(e) =>
                    patchForm({
                      anthropicEffort: e.target.value as "low" | "medium" | "high",
                    })
                  }
                >
                  <option value="high">High (recommended)</option>
                  <option value="medium">Medium (balanced)</option>
                  <option value="low">Low (faster, cheaper)</option>
                </select>
              </div>
            )}
          </>
        )}

        {fieldError && <p className="error">{fieldError}</p>}
        {error && <p className="error">{error}</p>}
      </div>

      <div className={styles.actions}>
        <button
          type="button"
          className={styles.button}
          onClick={handleBack}
          disabled={step === 1 || submitting}
        >
          Back
        </button>
        <button
          type="button"
          className={styles.buttonPrimary}
          onClick={handleNext}
          disabled={submitting || (step === 7 && loadingModels)}
        >
          {step === effectiveTotalSteps || (step === 7 && !showProviderConfig)
            ? submitting
              ? "Starting…"
              : "Start Analysis"
            : "Next"}
        </button>
      </div>
    </div>
  );
}
