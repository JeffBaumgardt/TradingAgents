/**
 * @file apps/web/src/components/Wizard.tsx
 * Multi-step configuration wizard for starting a new analysis run.
 */

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type {
  AnalystType,
  BillingAccountResponse,
  CreateSessionRequest,
  ProviderCostSource,
  ResearchDepth,
} from "@tradingagents/api-types";
import {
  normalizeTickerSymbol,
  shouldShowProviderConfigStep,
  todayIsoDate,
  validateAnalysisDateForWizard,
} from "@tradingagents/utils";
import ProviderCostBadge from "@/components/ProviderCostBadge";
import UpgradePlanNudge from "@/components/UpgradePlanNudge";
import {
  ApiClientError,
  createSession,
  fetchBillingAccount,
  fetchCredentialsSchema,
  fetchProviderModels,
} from "@/lib/api-client";
import { useUserSession } from "@/context/UserSessionContext";
import styles from "./Wizard.module.css";

const TOTAL_STEPS = 8;

const STEP_TITLES: Record<number, string> = {
  1: "Choose a ticker",
  2: "Add your investing context",
  3: "Pick the analysis date",
  4: "Select analyst agents",
  5: "Set research depth",
  6: "Choose an LLM provider",
  7: "Configure thinking models",
  8: "Fine-tune provider settings",
};

const STEP_DESCRIPTIONS: Record<number, string> = {
  1: "Enter the stock or ETF symbol you want the agents to analyze.",
  2: "Tell the agents about your situation so recommendations fit your goals. Leave this blank if you only want a general market analysis.",
  3: "Agents will use market data available on or before this date.",
  4: "Each analyst focuses on a different angle — market trends, news, sentiment, or fundamentals.",
  5: "Higher depth runs more debate rounds between agents. Deeper runs take longer and use more tokens.",
  6: "Pick a provider. Your key stays on your bill; Hosted providers use platform keys and count toward your allowance.",
  7: "Quick models handle routine steps; deep models power the final investment debate. Expensive models consume more billable units on Hosted.",
  8: "Optional provider-specific settings that affect reasoning quality and speed.",
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

interface ProviderChoice {
  id: string;
  label: string;
  backendUrl?: string | null;
  selectable: boolean;
  costSource: ProviderCostSource | null;
}

export default function Wizard() {
  const router = useRouter();
  const { resolvedConfig, providerCredentials, credentialDefinitions, setCredentialDefinitions } =
    useUserSession();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<WizardFormState>(DEFAULT_FORM);
  const options = resolvedConfig;
  const [billingAccount, setBillingAccount] = useState<BillingAccountResponse | null>(null);
  const [quickModels, setQuickModels] = useState<{ id: string; label: string }[]>([]);
  const [deepModels, setDeepModels] = useState<{ id: string; label: string }[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function loadBillingAndSchema() {
      try {
        const [account, schema] = await Promise.all([
          fetchBillingAccount().catch(() => null),
          credentialDefinitions.length > 0
            ? Promise.resolve(null)
            : fetchCredentialsSchema(),
        ]);
        if (cancelled) {
          return;
        }
        if (account) {
          setBillingAccount(account);
        }
        if (schema) {
          setCredentialDefinitions(schema.providers);
        }
      } catch {
        // Wizard still works with resolvedConfig-only providers.
      }
    }
    void loadBillingAndSchema();
    return () => {
      cancelled = true;
    };
  }, [credentialDefinitions.length, setCredentialDefinitions]);

  const isHostedPlan =
    billingAccount?.subscription.planId === "hosted" &&
    billingAccount.subscription.status === "active";

  const providerChoices = useMemo<ProviderChoice[]>(() => {
    const defs =
      credentialDefinitions.length > 0
        ? credentialDefinitions
        : (options?.providers ?? []).map((provider) => ({
            id: provider.id,
            label: provider.label,
            backendUrl: provider.backendUrl,
          }));

    return defs.map((provider) => {
      const hasKey = Boolean(providerCredentials[provider.id]?.apiKey?.trim());
      const hostedAvailable =
        isHostedPlan &&
        (billingAccount?.hostedProviderIds.includes(provider.id) ?? false);
      const selectable = hasKey || hostedAvailable;
      const costSource: ProviderCostSource | null = hasKey
        ? "self_pay"
        : hostedAvailable
          ? "hosted"
          : null;
      return {
        id: provider.id,
        label: provider.label,
        backendUrl: "backendUrl" in provider ? provider.backendUrl : null,
        selectable,
        costSource,
      };
    });
  }, [
    billingAccount?.hostedProviderIds,
    credentialDefinitions,
    isHostedPlan,
    options?.providers,
    providerCredentials,
  ]);

  const selectedProviderChoice = providerChoices.find(
    (provider) => provider.id === form.llmProvider,
  );
  const lockedProviders = providerChoices.filter((provider) => !provider.selectable);

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

  useEffect(() => {
    if (providerChoices.length === 0) {
      return;
    }
    const current = providerChoices.find((provider) => provider.id === form.llmProvider);
    if (current?.selectable) {
      return;
    }
    const fallback = providerChoices.find((provider) => provider.selectable);
    if (!fallback) {
      return;
    }
    setForm((prev) => ({
      ...prev,
      llmProvider: fallback.id,
      backendUrl: fallback.backendUrl ?? null,
    }));
  }, [form.llmProvider, providerChoices]);

  const loadModels = useCallback(
    async (provider: string) => {
      setLoadingModels(true);
      try {
        const [quick, deep] = await Promise.all([
          fetchProviderModels(provider, "quick"),
          fetchProviderModels(provider, "deep"),
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
    [],
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
  const progressPercent = Math.round((step / effectiveTotalSteps) * 100);

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

  function goToStep(nextStep: number) {
    setFieldError(null);
    setStep(nextStep);
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

  const primaryButtonLabel =
    step === effectiveTotalSteps || (step === 7 && !showProviderConfig)
      ? submitting
        ? "Starting analysis…"
        : "Start analysis run"
      : "Continue to next step";

  if (!options) {
    return (
      <div className={styles.panel}>
        <p className="error" role="alert">
          No provider credentials configured. Add at least one API key on the API keys page first.
        </p>
      </div>
    );
  }

  if (options.providers.length === 0) {
    return (
      <div className={styles.panel}>
        <p className="error" role="alert">
          No LLM providers are available with your current credentials.
        </p>
      </div>
    );
  }

  return (
    <div className={styles.wizard} aria-labelledby="wizard-step-title">
      <div className={styles.stepHeader}>
        <div className={styles.stepHeading}>
          <h3 id="wizard-step-title" className={styles.stepTitle}>
            Step {step} of {effectiveTotalSteps}: {STEP_TITLES[step]}
          </h3>
          <p className={styles.stepDescription}>{STEP_DESCRIPTIONS[step]}</p>
        </div>
        <div className={styles.stepMeta}>
          <span className={styles.stepIndicator} aria-hidden>
            {step} / {effectiveTotalSteps}
          </span>
          <div
            className={styles.progressTrack}
            role="progressbar"
            aria-valuemin={1}
            aria-valuemax={effectiveTotalSteps}
            aria-valuenow={step}
            aria-label={`Setup progress: step ${step} of ${effectiveTotalSteps}`}
          >
            <div
              className={styles.progressFill}
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      </div>

      <p className={styles.liveRegion} aria-live="polite" aria-atomic="true">
        Step {step}: {STEP_TITLES[step]}
      </p>

      <div className={styles.panel}>
        {step === 1 && (
          <div className={styles.field}>
            <label htmlFor="ticker">Ticker symbol</label>
            <input
              id="ticker"
              value={form.ticker}
              onChange={(e) => patchForm({ ticker: e.target.value })}
              placeholder="SPY"
              autoComplete="off"
              spellCheck={false}
              aria-describedby="ticker-hint"
            />
            <p id="ticker-hint" className={styles.hint}>
              Use the exchange symbol for the security you want analyzed.
            </p>
            <ul className={styles.exampleList} aria-label="Ticker examples">
              <li>US stocks &amp; ETFs: SPY, AAPL, MSFT</li>
              <li>Canadian: CNC.TO</li>
              <li>International: 7203.T, 0700.HK</li>
            </ul>
          </div>
        )}

        {step === 2 && (
          <>
            <p className={`callout ${styles.stepCallout}`}>
              <strong>This step is optional.</strong> Without your input, the agents still
              produce a full market analysis of {form.ticker.trim() || "your ticker"}. Your
              context helps them tailor recommendations to your portfolio, risk tolerance, or
              specific questions.
            </p>
            <div className={styles.field}>
              <div className={styles.fieldLabelRow}>
                <label htmlFor="userContext">Your investing context</label>
                <span className="optionalBadge">Optional</span>
              </div>
              <textarea
                id="userContext"
                rows={6}
                value={form.userContext}
                onChange={(e) => patchForm({ userContext: e.target.value })}
                placeholder="Example: I hold 200 shares with a $180 cost basis and am considering adding on a dip. I have a 3–5 year horizon and moderate risk tolerance."
                aria-describedby="user-context-hint"
              />
              <p id="user-context-hint" className={styles.hint}>
                Share holdings, options positions, time horizon, risk tolerance, or the decision
                you are trying to make. The more specific you are, the more focused the final
                recommendation.
              </p>
            </div>
          </>
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
              aria-describedby="analysis-date-hint"
            />
            <p id="analysis-date-hint" className={styles.hint}>
              Agents use market data available on or before this date. Today is selected by default.
            </p>
          </div>
        )}

        {step === 4 && (
          <fieldset className={styles.checkboxGroup}>
            <legend className={styles.checkboxLegend}>Select at least one analyst</legend>
            {options.analysts.map((analyst) => (
              <label key={analyst.value} className={styles.checkboxRow}>
                <input
                  type="checkbox"
                  checked={form.analysts.includes(analyst.value as AnalystType)}
                  onChange={() => toggleAnalyst(analyst.value as AnalystType)}
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
            <label htmlFor="llmProvider">LLM provider</label>
            <select
              id="llmProvider"
              value={form.llmProvider}
              onChange={(e) => {
                const provider = providerChoices.find((p) => p.id === e.target.value);
                if (!provider?.selectable) {
                  return;
                }
                patchForm({
                  llmProvider: e.target.value,
                  backendUrl: provider.backendUrl ?? null,
                });
              }}
              aria-describedby="llm-provider-hint"
            >
              {(providerChoices.length > 0
                ? providerChoices
                : (options.providers ?? []).map((provider) => ({
                    id: provider.id,
                    label: provider.label,
                    backendUrl: provider.backendUrl,
                    selectable: true,
                    costSource: "self_pay" as const,
                  }))
              ).map((provider) => (
                <option
                  key={provider.id}
                  value={provider.id}
                  disabled={!provider.selectable}
                >
                  {provider.label}
                  {provider.costSource === "self_pay"
                    ? " — Your key"
                    : provider.costSource === "hosted"
                      ? " — Hosted"
                      : " — Upgrade required"}
                </option>
              ))}
            </select>
            {selectedProviderChoice?.costSource ? (
              <p className={styles.providerStatus} id="llm-provider-hint">
                <ProviderCostBadge source={selectedProviderChoice.costSource} />
                <span>
                  {selectedProviderChoice.costSource === "self_pay"
                    ? "This provider uses your API key and does not consume hosted allowance."
                    : "This provider uses platform keys and counts toward your hosted allowance."}
                </span>
              </p>
            ) : (
              <p id="llm-provider-hint" className={styles.hint}>
                Providers with a saved key, or Hosted-plan providers, appear as selectable.
              </p>
            )}
            {selectedProviderChoice?.costSource === "hosted" ? (
              <p className={styles.hint}>
                Hosted inference wiring is still rolling out — if a run fails, add your own key for
                this provider or check Billing for plan status.
              </p>
            ) : null}
            {lockedProviders.length > 0 ? (
              <div className={styles.lockedProviders}>
                <p className={styles.hint}>
                  Want a provider you do not have a key for?
                </p>
                <UpgradePlanNudge
                  providerLabel={lockedProviders[0]?.label ?? "another provider"}
                  compact
                />
                {isHostedPlan ? (
                  <p className={styles.hint}>
                    Or <a href="/settings/credentials">add your own API key</a> to run that
                    provider as Your key (self-pay).
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>
        )}

        {step === 7 && (
          <>
            {loadingModels ? (
              <p className={styles.hint} aria-live="polite">
                Loading available models…
              </p>
            ) : (
              <>
                <div className={styles.field}>
                  <div className={styles.fieldLabelRow}>
                    <label htmlFor="quickModel">Quick-thinking model</label>
                    {selectedProviderChoice?.costSource ? (
                      <ProviderCostBadge source={selectedProviderChoice.costSource} />
                    ) : null}
                  </div>
                  <select
                    id="quickModel"
                    value={form.quickThinkLlm}
                    onChange={(e) => patchForm({ quickThinkLlm: e.target.value })}
                    aria-describedby="quick-model-hint"
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
                      aria-label="Custom quick-thinking model ID"
                    />
                  )}
                  <p id="quick-model-hint" className={styles.hint}>
                    Used for faster steps like data gathering and initial summaries.
                  </p>
                </div>
                <div className={styles.field}>
                  <label htmlFor="deepModel">Deep-thinking model</label>
                  <select
                    id="deepModel"
                    value={form.deepThinkLlm}
                    onChange={(e) => patchForm({ deepThinkLlm: e.target.value })}
                    aria-describedby="deep-model-hint"
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
                      aria-label="Custom deep-thinking model ID"
                    />
                  )}
                  <p id="deep-model-hint" className={styles.hint}>
                    Powers the investment debate and final trade recommendation.
                  </p>
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
            disabled={submitting || (step === 7 && loadingModels)}
            aria-label={primaryButtonLabel}
          >
            {primaryButtonLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
