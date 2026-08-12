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
  /** Standard input USD per 1M tokens (operator cost; not shown to users). */
  inputUsdPer1M: number;
  /** Standard output USD per 1M tokens (operator cost; not shown to users). */
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
 * Operator list prices ($/1M tokens). Credits hide the in/out split from users.
 * Output is 5× input, so 1 output token = 5 credits before margin.
 */
export const AGENTS_MODEL_INPUT_USD_PER_1M = 2;
export const AGENTS_MODEL_OUTPUT_USD_PER_1M = 10;

/**
 * Platform markup applied when converting tokens → credits.
 * 10M credits ≈ 1.90M output tokens (~2M advertised); $19 Pro ≈ $19 of
 * list-price inference (vs $20 of raw 2M output), leaving a little room
 * for platform cost vs a direct Anthropic monthly sub.
 */
export const COMPUTE_CREDIT_MARGIN = 1.05;

/** 1 input token = 1 credit before margin. */
export const AGENTS_MODEL_INPUT_CREDITS_PER_TOKEN = 1;

/** 1 output token = 5 credits before margin ($10 / $2). */
export const AGENTS_MODEL_OUTPUT_CREDITS_PER_TOKEN =
  AGENTS_MODEL_OUTPUT_USD_PER_1M / AGENTS_MODEL_INPUT_USD_PER_1M;

/**
 * Advertised Pro equivalent: 10M credits ≈ 2M output tokens.
 * Exact math is 10M / (5 × 1.05) ≈ 1.90M; copy uses the round number.
 */
export const PRO_MONTHLY_OUTPUT_TOKEN_EQUIVALENT = 2_000_000;

/**
 * Observed shallow run (depth 1, 2026-08-11): 16.6k out / 88.2k total.
 * Used only for preflight estimates, not live metering.
 */
export const AGENTS_MODEL_TYPICAL_OUTPUT_SHARE = 16_600 / 88_200;

/** ISO date the catalog prices were last reviewed against provider docs. */
export const HOSTED_MODEL_CATALOG_PRICED_AS_OF = "2026-07-21";

/**
 * @deprecated Use {@link AGENTS_MODEL_OUTPUT_USD_PER_1M}. Old cheap-model
 * reference ($0.28/1M) is no longer the credit basis.
 */
export const COMPUTE_CREDIT_BASE_OUTPUT_USD_PER_1M = AGENTS_MODEL_OUTPUT_USD_PER_1M;

/**
 * @deprecated Use {@link AGENTS_MODEL_OUTPUT_USD_PER_1M}. Kept so catalog
 * helpers still expose a single output list-price field.
 */
export const COMPUTE_CREDIT_REFERENCE_OUTPUT_USD_PER_1M = AGENTS_MODEL_OUTPUT_USD_PER_1M;

/**
 * @deprecated Product no longer uses a single token multiplier. Billing is
 * {@link computeAgentsModelCredits} (input × 1 + output × 5, then margin).
 */
export const AGENTS_MODEL_CREDIT_MULTIPLIER = AGENTS_MODEL_OUTPUT_CREDITS_PER_TOKEN;

export interface AgentsModelCreditRates {
  /** Credits charged per input token (includes margin). */
  inputCreditsPerToken: number;
  /** Credits charged per output token (includes margin). */
  outputCreditsPerToken: number;
}

/** Margin-inclusive rates passed to metering. */
export function getAgentsModelCreditRates(): AgentsModelCreditRates {
  return {
    inputCreditsPerToken: AGENTS_MODEL_INPUT_CREDITS_PER_TOKEN * COMPUTE_CREDIT_MARGIN,
    outputCreditsPerToken: AGENTS_MODEL_OUTPUT_CREDITS_PER_TOKEN * COMPUTE_CREDIT_MARGIN,
  };
}

/** Convert observed tokens into compute credits (1 in + 5 out, × margin). */
export function computeAgentsModelCredits(tokensIn: number, tokensOut: number): number {
  const rates = getAgentsModelCreditRates();
  return Math.round(
    Math.max(0, tokensIn) * rates.inputCreditsPerToken +
      Math.max(0, tokensOut) * rates.outputCreditsPerToken,
  );
}

/** Preflight helper: map a token-volume guess onto credits using the typical mix. */
export function estimateAgentsModelCreditsFromTokenVolume(tokens: number): number {
  const volume = Math.max(0, tokens);
  const tokensOut = volume * AGENTS_MODEL_TYPICAL_OUTPUT_SHARE;
  const tokensIn = volume - tokensOut;
  return computeAgentsModelCredits(tokensIn, tokensOut);
}

/**
 * Product model catalog — Agents Model only.
 * USD list prices are operator-only; end-user UI should only show displayName
 * and compute credits.
 */
export const HOSTED_MODEL_CATALOG: readonly HostedModelCostEntry[] = [
  {
    providerId: "anthropic",
    providerLabel: AGENTS_MODEL_DISPLAY_NAME,
    modelId: AGENTS_MODEL_ID,
    displayName: AGENTS_MODEL_DISPLAY_NAME,
    modes: ["quick", "deep"],
    inputUsdPer1M: AGENTS_MODEL_INPUT_USD_PER_1M,
    outputUsdPer1M: AGENTS_MODEL_OUTPUT_USD_PER_1M,
    notes: "USD list price is operator-only. Product bills 1 credit per input token and 5 per output token, plus 5% margin.",
  },
] as const;

/** Alias for product-facing naming. */
export const PRODUCT_MODEL_CATALOG = HOSTED_MODEL_CATALOG;

/** Round multiplier for stable UI + metering. */
export function roundCreditMultiplier(value: number): number {
  return Math.round(value * 10) / 10;
}

/**
 * @deprecated Output/input list-price ratio (5 for Agents Model). Not a
 * global token multiplier — use {@link computeAgentsModelCredits}.
 */
export function creditMultiplierFromOutputUsdPer1M(outputUsdPer1M: number): number {
  if (!Number.isFinite(outputUsdPer1M) || outputUsdPer1M <= 0) {
    return AGENTS_MODEL_OUTPUT_CREDITS_PER_TOKEN;
  }
  return roundCreditMultiplier(outputUsdPer1M / AGENTS_MODEL_INPUT_USD_PER_1M);
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
 * @deprecated Always the output credit weight (5). Live billing uses
 * {@link computeAgentsModelCredits} instead of tokens × this.
 */
export function getModelCreditMultiplier(_providerId?: string, _modelId?: string): number {
  return AGENTS_MODEL_OUTPUT_CREDITS_PER_TOKEN;
}

export function listHostedModelCatalog() {
  const rates = getAgentsModelCreditRates();
  return {
    pricedAsOf: HOSTED_MODEL_CATALOG_PRICED_AS_OF,
    referenceOutputUsdPer1M: AGENTS_MODEL_OUTPUT_USD_PER_1M,
    inputCreditsPerToken: rates.inputCreditsPerToken,
    outputCreditsPerToken: rates.outputCreditsPerToken,
    models: HOSTED_MODEL_CATALOG.map((entry) => ({
      ...entry,
      inputCreditsPerToken: rates.inputCreditsPerToken,
      outputCreditsPerToken: rates.outputCreditsPerToken,
    })),
  };
}
