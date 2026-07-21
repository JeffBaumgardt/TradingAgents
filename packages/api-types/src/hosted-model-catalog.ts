/**
 * @file packages/api-types/src/hosted-model-catalog.ts
 * Curated text/agent models for TradingAgents hosted inference + API list prices.
 *
 * Excludes image/video/audio/embeddings (e.g. Sora) and ultra-premium Pro SKUs that
 * are a poor fit for multi-agent analysis swarms. Prices are USD per 1M tokens
 * (standard/paid tier, short-context rates). Verify against provider docs before
 * production metering.
 */

export type HostedModelProviderId =
  | "openai"
  | "anthropic"
  | "google"
  | "xai"
  | "deepseek";

export interface HostedModelCostEntry {
  providerId: HostedModelProviderId;
  providerLabel: string;
  modelId: string;
  /** Short label for UI. */
  displayName: string;
  /** Preferred wizard bucket. */
  modes: Array<"quick" | "deep">;
  /** Standard input USD per 1M tokens. */
  inputUsdPer1M: number;
  /** Standard output USD per 1M tokens (basis for compute-credit multipliers). */
  outputUsdPer1M: number;
  /** Optional notes (cache tiers, context surcharges, provisional IDs). */
  notes?: string;
}

/**
 * Cheapest output rate in {@link HOSTED_MODEL_CATALOG} — DeepSeek V4 Flash.
 * One compute credit ≈ one token on this reference model.
 */
export const COMPUTE_CREDIT_REFERENCE_OUTPUT_USD_PER_1M = 0.28;

/** ISO date the catalog prices were last reviewed against provider docs. */
export const HOSTED_MODEL_CATALOG_PRICED_AS_OF = "2026-07-20";

/**
 * Curated hosted catalog for TradingAgents.
 * Sources: OpenAI, Anthropic, Google Gemini, xAI, and DeepSeek public API pricing.
 */
export const HOSTED_MODEL_CATALOG: readonly HostedModelCostEntry[] = [
  // OpenAI — https://developers.openai.com/api/docs/pricing
  {
    providerId: "openai",
    providerLabel: "OpenAI",
    modelId: "gpt-5.4-nano",
    displayName: "GPT-5.4 Nano",
    modes: ["quick"],
    inputUsdPer1M: 0.2,
    outputUsdPer1M: 1.25,
  },
  {
    providerId: "openai",
    providerLabel: "OpenAI",
    modelId: "gpt-5.4-mini",
    displayName: "GPT-5.4 Mini",
    modes: ["quick"],
    inputUsdPer1M: 0.75,
    outputUsdPer1M: 4.5,
  },
  {
    providerId: "openai",
    providerLabel: "OpenAI",
    modelId: "gpt-5-mini",
    displayName: "GPT-5 Mini",
    modes: ["quick"],
    inputUsdPer1M: 0.25,
    outputUsdPer1M: 2,
  },
  {
    providerId: "openai",
    providerLabel: "OpenAI",
    modelId: "gpt-4.1-mini",
    displayName: "GPT-4.1 Mini",
    modes: ["quick"],
    inputUsdPer1M: 0.4,
    outputUsdPer1M: 1.6,
  },
  {
    providerId: "openai",
    providerLabel: "OpenAI",
    modelId: "gpt-4o-mini",
    displayName: "GPT-4o Mini",
    modes: ["quick"],
    inputUsdPer1M: 0.15,
    outputUsdPer1M: 0.6,
  },
  {
    providerId: "openai",
    providerLabel: "OpenAI",
    modelId: "gpt-4.1",
    displayName: "GPT-4.1",
    modes: ["quick", "deep"],
    inputUsdPer1M: 2,
    outputUsdPer1M: 8,
  },
  {
    providerId: "openai",
    providerLabel: "OpenAI",
    modelId: "gpt-4o",
    displayName: "GPT-4o",
    modes: ["quick", "deep"],
    inputUsdPer1M: 2.5,
    outputUsdPer1M: 10,
  },
  {
    providerId: "openai",
    providerLabel: "OpenAI",
    modelId: "gpt-5",
    displayName: "GPT-5",
    modes: ["quick", "deep"],
    inputUsdPer1M: 1.25,
    outputUsdPer1M: 10,
  },
  {
    providerId: "openai",
    providerLabel: "OpenAI",
    modelId: "gpt-5.2",
    displayName: "GPT-5.2",
    modes: ["deep"],
    inputUsdPer1M: 1.75,
    outputUsdPer1M: 14,
  },
  {
    providerId: "openai",
    providerLabel: "OpenAI",
    modelId: "gpt-5.4",
    displayName: "GPT-5.4",
    modes: ["deep"],
    inputUsdPer1M: 2.5,
    outputUsdPer1M: 15,
    notes: "Short-context (<272K) standard tier.",
  },
  {
    providerId: "openai",
    providerLabel: "OpenAI",
    modelId: "gpt-5.5",
    displayName: "GPT-5.5",
    modes: ["deep"],
    inputUsdPer1M: 5,
    outputUsdPer1M: 30,
    notes: "Short-context (<272K) standard tier.",
  },
  {
    providerId: "openai",
    providerLabel: "OpenAI",
    modelId: "o4-mini",
    displayName: "o4-mini",
    modes: ["deep"],
    inputUsdPer1M: 1.1,
    outputUsdPer1M: 4.4,
  },
  {
    providerId: "openai",
    providerLabel: "OpenAI",
    modelId: "o3",
    displayName: "o3",
    modes: ["deep"],
    inputUsdPer1M: 2,
    outputUsdPer1M: 8,
  },

  // Anthropic — https://www.anthropic.com/pricing
  {
    providerId: "anthropic",
    providerLabel: "Anthropic",
    modelId: "claude-haiku-4-5",
    displayName: "Claude Haiku 4.5",
    modes: ["quick"],
    inputUsdPer1M: 1,
    outputUsdPer1M: 5,
  },
  {
    providerId: "anthropic",
    providerLabel: "Anthropic",
    modelId: "claude-sonnet-4-6",
    displayName: "Claude Sonnet 4.6",
    modes: ["quick", "deep"],
    inputUsdPer1M: 3,
    outputUsdPer1M: 15,
  },
  {
    providerId: "anthropic",
    providerLabel: "Anthropic",
    modelId: "claude-opus-4-6",
    displayName: "Claude Opus 4.6",
    modes: ["deep"],
    inputUsdPer1M: 5,
    outputUsdPer1M: 25,
  },
  {
    providerId: "anthropic",
    providerLabel: "Anthropic",
    modelId: "claude-opus-4-7",
    displayName: "Claude Opus 4.7",
    modes: ["deep"],
    inputUsdPer1M: 5,
    outputUsdPer1M: 25,
  },
  {
    providerId: "anthropic",
    providerLabel: "Anthropic",
    modelId: "claude-opus-4-8",
    displayName: "Claude Opus 4.8",
    modes: ["deep"],
    inputUsdPer1M: 5,
    outputUsdPer1M: 25,
  },

  // Google — https://ai.google.dev/gemini-api/docs/pricing
  {
    providerId: "google",
    providerLabel: "Google",
    modelId: "gemini-3.1-flash-lite",
    displayName: "Gemini 3.1 Flash Lite",
    modes: ["quick"],
    inputUsdPer1M: 0.25,
    outputUsdPer1M: 1.5,
  },
  {
    providerId: "google",
    providerLabel: "Google",
    modelId: "gemini-3.5-flash",
    displayName: "Gemini 3.5 Flash",
    modes: ["quick", "deep"],
    inputUsdPer1M: 1.5,
    outputUsdPer1M: 9,
  },
  {
    providerId: "google",
    providerLabel: "Google",
    modelId: "gemini-3.1-pro-preview",
    displayName: "Gemini 3.1 Pro",
    modes: ["deep"],
    inputUsdPer1M: 2,
    outputUsdPer1M: 12,
    notes: "≤200K prompt tier; higher rates above 200K.",
  },

  // xAI — https://docs.x.ai/developers/pricing
  {
    providerId: "xai",
    providerLabel: "xAI",
    modelId: "grok-build-0.1",
    displayName: "Grok Build 0.1",
    modes: ["quick"],
    inputUsdPer1M: 1,
    outputUsdPer1M: 2,
    notes: "≤200K prompt tier.",
  },
  {
    providerId: "xai",
    providerLabel: "xAI",
    modelId: "grok-4.20-0309-non-reasoning",
    displayName: "Grok 4.20 (Non-Reasoning)",
    modes: ["quick"],
    inputUsdPer1M: 1.25,
    outputUsdPer1M: 2.5,
    notes: "≤200K prompt tier.",
  },
  {
    providerId: "xai",
    providerLabel: "xAI",
    modelId: "grok-4.3",
    displayName: "Grok 4.3",
    modes: ["quick", "deep"],
    inputUsdPer1M: 1.25,
    outputUsdPer1M: 2.5,
    notes: "≤200K prompt tier.",
  },
  {
    providerId: "xai",
    providerLabel: "xAI",
    modelId: "grok-4.20-0309-reasoning",
    displayName: "Grok 4.20 (Reasoning)",
    modes: ["deep"],
    inputUsdPer1M: 1.25,
    outputUsdPer1M: 2.5,
    notes: "≤200K prompt tier.",
  },
  {
    providerId: "xai",
    providerLabel: "xAI",
    modelId: "grok-4.20-multi-agent-0309",
    displayName: "Grok 4.20 Multi-Agent",
    modes: ["deep"],
    inputUsdPer1M: 1.25,
    outputUsdPer1M: 2.5,
    notes: "≤200K prompt tier.",
  },
  {
    providerId: "xai",
    providerLabel: "xAI",
    modelId: "grok-4.5",
    displayName: "Grok 4.5",
    modes: ["deep"],
    inputUsdPer1M: 2,
    outputUsdPer1M: 6,
    notes: "≤200K prompt tier.",
  },

  // DeepSeek — cache-miss input + output (standard production rates)
  {
    providerId: "deepseek",
    providerLabel: "DeepSeek",
    modelId: "deepseek-v4-flash",
    displayName: "DeepSeek V4 Flash",
    modes: ["quick", "deep"],
    inputUsdPer1M: 0.14,
    outputUsdPer1M: 0.28,
    notes: "Input rate is cache-miss; cache-hit input is much lower.",
  },
  {
    providerId: "deepseek",
    providerLabel: "DeepSeek",
    modelId: "deepseek-v4-pro",
    displayName: "DeepSeek V4 Pro",
    modes: ["deep"],
    inputUsdPer1M: 0.435,
    outputUsdPer1M: 0.87,
    notes: "Input rate is cache-miss; cache-hit input is much lower.",
  },
] as const;

/** Round multiplier for stable UI + metering. */
export function roundCreditMultiplier(value: number): number {
  return Math.round(value * 10) / 10;
}

/**
 * Output-cost multiplier vs {@link COMPUTE_CREDIT_REFERENCE_OUTPUT_USD_PER_1M}.
 * Cheap models ≈ 1×; frontier models are much higher.
 */
export function creditMultiplierFromOutputUsdPer1M(outputUsdPer1M: number): number {
  if (!Number.isFinite(outputUsdPer1M) || outputUsdPer1M <= 0) {
    return 1;
  }
  return roundCreditMultiplier(outputUsdPer1M / COMPUTE_CREDIT_REFERENCE_OUTPUT_USD_PER_1M);
}

export function getHostedModelCostEntry(
  providerId: string,
  modelId: string,
): HostedModelCostEntry | undefined {
  const provider = providerId.toLowerCase();
  const model = modelId.toLowerCase();
  return HOSTED_MODEL_CATALOG.find(
    (entry) => entry.providerId === provider && entry.modelId.toLowerCase() === model,
  );
}

/**
 * Resolve a compute-credit multiplier for a provider/model pair.
 * Exact catalog match first; then substring heuristics; else mid-tier default.
 */
export function getModelCreditMultiplier(providerId: string, modelId: string): number {
  const exact = getHostedModelCostEntry(providerId, modelId);
  if (exact) {
    return creditMultiplierFromOutputUsdPer1M(exact.outputUsdPer1M);
  }

  const model = modelId.toLowerCase();
  if (model.includes("nano") || model.includes("flash-lite")) {
    return creditMultiplierFromOutputUsdPer1M(1.25);
  }
  if (model.includes("haiku") || model.includes("mini") || model.includes("flash")) {
    return creditMultiplierFromOutputUsdPer1M(5);
  }
  if (model.includes("opus") || model.includes("pro") || model.includes("o1")) {
    return creditMultiplierFromOutputUsdPer1M(25);
  }
  if (model.includes("sonnet") || model.includes("gpt-5.5") || model.includes("gpt-4")) {
    return creditMultiplierFromOutputUsdPer1M(15);
  }
  // Mid-tier default (~GPT-5 / Gemini Flash range).
  return creditMultiplierFromOutputUsdPer1M(10);
}

export function listHostedModelCatalog() {
  return {
    pricedAsOf: HOSTED_MODEL_CATALOG_PRICED_AS_OF,
    referenceOutputUsdPer1M: COMPUTE_CREDIT_REFERENCE_OUTPUT_USD_PER_1M,
    models: HOSTED_MODEL_CATALOG.map((entry) => ({
      ...entry,
      creditMultiplier: creditMultiplierFromOutputUsdPer1M(entry.outputUsdPer1M),
    })),
  };
}
