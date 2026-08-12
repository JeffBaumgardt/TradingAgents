/**
 * apps/api/src/services/model-catalog-service.ts
 *
 * Hosted model catalog + credit multipliers from Postgres, with static fallback.
 */

import {
  AGENTS_MODEL_OUTPUT_USD_PER_1M,
  HOSTED_MODEL_CATALOG_PRICED_AS_OF,
  getAgentsModelCreditRates,
  listHostedModelCatalog,
} from "@tradingagents/api-types";
import type { AppSupabaseClient, ModelCreditMultiplierRow } from "@tradingagents/supabase";
import { getPlanCreditConfig } from "./credit-service.js";

export async function listHostedModelsFromDb(client: AppSupabaseClient) {
  // Reference rate is shared across product plans; pro config is representative.
  const config = await getPlanCreditConfig(client, "pro");
  const { data, error } = await client
    .from("model_credit_multipliers")
    .select("*")
    .eq("is_active", true)
    .order("provider_id", { ascending: true })
    .order("model_id", { ascending: true });

  if (error || !data || data.length === 0) {
    return listHostedModelCatalog();
  }

  const rows = data as ModelCreditMultiplierRow[];
  const rates = getAgentsModelCreditRates();
  return {
    pricedAsOf: HOSTED_MODEL_CATALOG_PRICED_AS_OF,
    referenceOutputUsdPer1M:
      Number(config.reference_output_usd_per_1m) || AGENTS_MODEL_OUTPUT_USD_PER_1M,
    inputCreditsPerToken: rates.inputCreditsPerToken,
    outputCreditsPerToken: rates.outputCreditsPerToken,
    models: rows.map((row) => ({
      providerId: row.provider_id as "anthropic",
      providerLabel: row.provider_label,
      modelId: row.model_id,
      displayName: row.display_name,
      modes: (Array.isArray(row.modes) ? row.modes : []) as Array<"quick" | "deep">,
      inputUsdPer1M: Number(row.input_usd_per_1m),
      outputUsdPer1M: Number(row.output_usd_per_1m),
      notes: row.notes ?? undefined,
      inputCreditsPerToken: rates.inputCreditsPerToken,
      outputCreditsPerToken: rates.outputCreditsPerToken,
    })),
  };
}
