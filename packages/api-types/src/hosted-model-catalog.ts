/**
 * @file packages/api-types/src/hosted-model-catalog.ts
 * Product inference catalog — single Agents Model entry (provider/id internal only).
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

/** Fixed product model id (internal; never display to end users). */
export const AGENTS_MODEL_ID = "claude-sonnet-5";

/**
 * Product unit: 1 compute credit = 1 Agents Model token (input + output).
 *
 * Observed shallow run (depth 1, 2026-08-11): 71.6k in + 16.6k out ≈ 88.2k
 * tokens → ≈ 88.2k credits. Standard 3.33M ≈ 37 shallow runs; Pro 10M ≈ 113.
 */
export const AGENTS_MODEL_CREDIT_MULTIPLIER = 1;

/**
 * Operator margin / USD catalog (internal cost notes only — not used to bill).
 */
export const COMPUTE_CREDIT_MARGIN = 1.05;

/** Pass-through output reference before margin ($/1M tokens). */
export const COMPUTE_CREDIT_BASE_OUTPUT_USD_PER_1M = 0.28;

/**
 * Legacy USD reference used by catalog helpers. Billing uses
 * {@link AGENTS_MODEL_CREDIT_MULTIPLIER} instead.
 */
export const COMPUTE_CREDIT_REFERENCE_OUTPUT_USD_PER_1M =
  COMPUTE_CREDIT_BASE_OUTPUT_USD_PER_1M / COMPUTE_CREDIT_MARGIN;

/** ISO date the catalog prices were last reviewed against provider docs. */
export const HOSTED_MODEL_CATALOG_PRICED_AS_OF = "2026-07-21";

/**
 * Product model catalog — Agents Model only.
 * Pricing inputs are for metering; end-user UI should only show displayName.
 */
export const HOSTED_MODEL_CATALOG: readonly HostedModelCostEntry[] = [
  {
    providerId: "anthropic",
    providerLabel: AGENTS_MODEL_DISPLAY_NAME,
    modelId: AGENTS_MODEL_ID,
    displayName: AGENTS_MODEL_DISPLAY_NAME,
    modes: ["quick", "deep"],
    inputUsdPer1M: 2,
    outputUsdPer1M: 10,
    notes: "USD list price is operator-only; product bills 1 credit per token.",
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
 * Product billing multiplier. Always 1 credit per Agents Model token.
 */
export function getModelCreditMultiplier(_providerId?: string, _modelId?: string): number {
  return AGENTS_MODEL_CREDIT_MULTIPLIER;
}

export function listHostedModelCatalog() {
  return {
    pricedAsOf: HOSTED_MODEL_CATALOG_PRICED_AS_OF,
    referenceOutputUsdPer1M: COMPUTE_CREDIT_REFERENCE_OUTPUT_USD_PER_1M,
    models: HOSTED_MODEL_CATALOG.map((entry) => ({
      ...entry,
      creditMultiplier: AGENTS_MODEL_CREDIT_MULTIPLIER,
    })),
  };
}
