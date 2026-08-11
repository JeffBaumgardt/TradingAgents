/**
 * @file packages/api-types/src/hosted-model-catalog.ts
 * Product inference catalog — single Agents Model (Anthropic Claude Sonnet 5).
 *
 * Keep in sync with:
 * - public.model_credit_multipliers (Supabase migrations)
 * - docs on platform API keys / credits
 */

export type HostedModelProviderId = "anthropic";

export interface HostedModelCostEntry {
  providerId: HostedModelProviderId;
  providerLabel: string;
  modelId: string;
  /** Short label for UI. */
  displayName: string;
  /** Preferred wizard bucket (legacy catalog field). */
  modes: Array<"quick" | "deep">;
  /** Standard input USD per 1M tokens. */
  inputUsdPer1M: number;
  /** Standard output USD per 1M tokens (basis for compute-credit multipliers). */
  outputUsdPer1M: number;
  /** Optional notes (cache tiers, context surcharges, provisional IDs). */
  notes?: string;
}

/** Product-facing display name for the sole inference model. */
export const AGENTS_MODEL_DISPLAY_NAME = "Agents Model";

/** Fixed product LLM provider. */
export const AGENTS_MODEL_PROVIDER_ID: HostedModelProviderId = "anthropic";

/** Fixed product model id (Claude Sonnet 5). */
export const AGENTS_MODEL_ID = "claude-sonnet-5";

/**
 * Operator margin baked into credit metering. Multipliers = list output price
 * ÷ (base reference ÷ margin).
 */
export const COMPUTE_CREDIT_MARGIN = 1.05;

/** Pass-through output reference before margin ($/1M tokens). */
export const COMPUTE_CREDIT_BASE_OUTPUT_USD_PER_1M = 0.28;

/**
 * Credit unit after margin: base ÷ margin (≈ $0.2667/1M output tokens).
 * One compute credit ≈ one token at this rate.
 */
export const COMPUTE_CREDIT_REFERENCE_OUTPUT_USD_PER_1M =
  COMPUTE_CREDIT_BASE_OUTPUT_USD_PER_1M / COMPUTE_CREDIT_MARGIN;

/** ISO date the catalog prices were last reviewed against provider docs. */
export const HOSTED_MODEL_CATALOG_PRICED_AS_OF = "2026-07-21";

/**
 * Product model catalog — Agents Model only.
 * Anthropic introductory pricing on Sonnet 5 (see provider docs).
 */
export const HOSTED_MODEL_CATALOG: readonly HostedModelCostEntry[] = [
  {
    providerId: "anthropic",
    providerLabel: "Anthropic",
    modelId: AGENTS_MODEL_ID,
    displayName: AGENTS_MODEL_DISPLAY_NAME,
    modes: ["quick", "deep"],
    inputUsdPer1M: 2,
    outputUsdPer1M: 10,
    notes: "Introductory pricing through 2026-08-31; then $3/$15.",
  },
] as const;

/** Alias for product-facing naming. */
export const PRODUCT_MODEL_CATALOG = HOSTED_MODEL_CATALOG;

/** Round multiplier for stable UI + metering. */
export function roundCreditMultiplier(value: number): number {
  return Math.round(value * 10) / 10;
}

/**
 * Output-cost multiplier vs {@link COMPUTE_CREDIT_REFERENCE_OUTPUT_USD_PER_1M}.
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
 * Exact catalog match first; else Agents Model mid-tier default.
 */
export function getModelCreditMultiplier(providerId: string, modelId: string): number {
  const exact = getHostedModelCostEntry(providerId, modelId);
  if (exact) {
    return creditMultiplierFromOutputUsdPer1M(exact.outputUsdPer1M);
  }
  // Product runs always use Agents Model; unknown pairs use its multiplier.
  const agents = getHostedModelCostEntry(AGENTS_MODEL_PROVIDER_ID, AGENTS_MODEL_ID);
  if (agents) {
    return creditMultiplierFromOutputUsdPer1M(agents.outputUsdPer1M);
  }
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
