/**
 * apps/api/src/services/model-catalog-service.ts
 *
 * Hosted model catalog + credit multipliers from Postgres, with static fallback.
 */

import {
  COMPUTE_CREDIT_REFERENCE_OUTPUT_USD_PER_1M,
  HOSTED_MODEL_CATALOG_PRICED_AS_OF,
  listHostedModelCatalog,
} from "@tradingagents/api-types";
import type { AppSupabaseClient, ModelCreditMultiplierRow } from "@tradingagents/supabase";
import { getPlanCreditConfig } from "./credit-service.js";

export async function listHostedModelsFromDb(client: AppSupabaseClient) {
  const config = await getPlanCreditConfig(client, "hosted");
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
  return {
    pricedAsOf: HOSTED_MODEL_CATALOG_PRICED_AS_OF,
    referenceOutputUsdPer1M: Number(config.reference_output_usd_per_1m) || COMPUTE_CREDIT_REFERENCE_OUTPUT_USD_PER_1M,
    models: rows.map((row) => ({
      providerId: row.provider_id as
        | "openai"
        | "anthropic"
        | "google"
        | "xai",
      providerLabel: row.provider_label,
      modelId: row.model_id,
      displayName: row.display_name,
      modes: (Array.isArray(row.modes) ? row.modes : []) as Array<"quick" | "deep">,
      inputUsdPer1M: Number(row.input_usd_per_1m),
      outputUsdPer1M: Number(row.output_usd_per_1m),
      notes: row.notes ?? undefined,
      creditMultiplier: Number(row.credit_multiplier),
    })),
  };
}
