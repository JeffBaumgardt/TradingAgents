#!/usr/bin/env tsx
/**
 * Print Agents Model credit math (preflight estimates vs actual formula).
 *
 *   pnpm --filter @tradingagents/api exec tsx src/scripts/print-credit-math.ts
 *
 * After a real run, compare against session stats:
 *   actualCredits = (tokensIn + tokensOut) × multiplier
 */

import {
  AGENTS_MODEL_ID,
  AGENTS_MODEL_PROVIDER_ID,
  COMPUTE_CREDIT_REFERENCE_OUTPUT_USD_PER_1M,
  getHostedModelCostEntry,
  getModelCreditMultiplier,
  PRO_MONTHLY_COMPUTE_CREDIT_ALLOWANCE,
  STANDARD_MONTHLY_COMPUTE_CREDIT_ALLOWANCE,
} from "@tradingagents/api-types";

const ESTIMATED_TOKENS_BY_DEPTH: Record<string, number> = {
  "1": 80_000,
  "3": 250_000,
  "5": 500_000,
};

function main() {
  const entry = getHostedModelCostEntry(AGENTS_MODEL_PROVIDER_ID, AGENTS_MODEL_ID);
  const multiplier = getModelCreditMultiplier(AGENTS_MODEL_PROVIDER_ID, AGENTS_MODEL_ID);

  console.log("Agents Model credit knobs\n");
  console.log(`  model id (internal):     ${AGENTS_MODEL_ID}`);
  console.log(`  catalog output $/1M:     ${entry?.outputUsdPer1M}`);
  console.log(`  credit reference $/1M:   ${COMPUTE_CREDIT_REFERENCE_OUTPUT_USD_PER_1M}`);
  console.log(`  multiplier:              ${multiplier}`);
  console.log(
    `  formula:                 tokens × (${entry?.outputUsdPer1M} / ${COMPUTE_CREDIT_REFERENCE_OUTPUT_USD_PER_1M})`,
  );
  console.log("");
  console.log("Preflight estimates (guessed tokens, not measured):\n");
  console.log("  depth  tokens     × mult   = credits     vs Standard     vs Pro");

  for (const [depth, tokens] of Object.entries(ESTIMATED_TOKENS_BY_DEPTH)) {
    const credits = Math.round(tokens * multiplier);
    const stdRuns = Math.floor(
      (STANDARD_MONTHLY_COMPUTE_CREDIT_ALLOWANCE * 0.97) / credits,
    );
    const proRuns = Math.floor(
      (PRO_MONTHLY_COMPUTE_CREDIT_ALLOWANCE * 0.97) / credits,
    );
    console.log(
      `  ${depth.padEnd(5)} ${tokens.toLocaleString().padStart(9)}  × ${String(multiplier).padStart(4)}   = ${credits.toLocaleString().padStart(11)}    ~${stdRuns} runs         ~${proRuns} runs`,
    );
  }

  console.log("");
  console.log("9,375,000 = depth 3 (250,000 tokens) × 37.5");
  console.log("");
  console.log("After a sample run, read tokensIn + tokensOut from the run stats");
  console.log("panel (or session_usage_cursors) and multiply by the multiplier above.");
  console.log("Tune outputUsdPer1M (multiplier) and/or estimated_tokens_by_depth.");
}

main();
