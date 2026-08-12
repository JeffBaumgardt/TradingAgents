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
  "1": 100_000,
  "3": 280_000,
  "5": 550_000,
};

function main() {
  const entry = getHostedModelCostEntry(AGENTS_MODEL_PROVIDER_ID, AGENTS_MODEL_ID);
  const multiplier = getModelCreditMultiplier(AGENTS_MODEL_PROVIDER_ID, AGENTS_MODEL_ID);

  console.log("Agents Model credit knobs\n");
  console.log(`  model id (internal):     ${AGENTS_MODEL_ID}`);
  console.log(`  catalog output $/1M:     ${entry?.outputUsdPer1M}`);
  console.log(`  credit reference $/1M:   ${COMPUTE_CREDIT_REFERENCE_OUTPUT_USD_PER_1M}`);
  console.log(`  multiplier:              ${multiplier}`);
  console.log(`  formula:                 credits = (tokensIn + tokensOut) × ${multiplier}`);
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
  console.log("Shallow sample (2026-08-11): 71.6k in + 16.6k out = 88.2k tokens");
  console.log(`  billed at ×${multiplier} = ${Math.round(88_200 * multiplier).toLocaleString()} credits`);
  console.log("");
  console.log("1 credit = 1 Agents Model token. Tune DEFAULT_ESTIMATED_TOKENS after more samples.");
}

main();
