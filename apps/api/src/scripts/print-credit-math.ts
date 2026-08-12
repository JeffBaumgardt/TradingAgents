#!/usr/bin/env tsx
/**
 * Print Agents Model credit math (preflight estimates vs actual formula).
 *
 *   pnpm --filter @tradingagents/api exec tsx src/scripts/print-credit-math.ts
 *
 * After a real run, compare against session stats:
 *   actualCredits = tokensIn × 1.05 + tokensOut × 5.25
 */

import {
  AGENTS_MODEL_ID,
  AGENTS_MODEL_INPUT_USD_PER_1M,
  AGENTS_MODEL_OUTPUT_USD_PER_1M,
  AGENTS_MODEL_PROVIDER_ID,
  COMPUTE_CREDIT_MARGIN,
  PRO_MONTHLY_COMPUTE_CREDIT_ALLOWANCE,
  STANDARD_MONTHLY_COMPUTE_CREDIT_ALLOWANCE,
  computeAgentsModelCredits,
  estimateAgentsModelCreditsFromTokenVolume,
  getAgentsModelCreditRates,
  getHostedModelCostEntry,
} from "@tradingagents/api-types";

const ESTIMATED_TOKENS_BY_DEPTH: Record<string, number> = {
  "1": 100_000,
  "3": 280_000,
  "5": 550_000,
};

function main() {
  const entry = getHostedModelCostEntry(AGENTS_MODEL_PROVIDER_ID, AGENTS_MODEL_ID);
  const rates = getAgentsModelCreditRates();

  console.log("Agents Model credit knobs\n");
  console.log(`  model id (internal):     ${AGENTS_MODEL_ID}`);
  console.log(`  catalog input $/1M:      ${entry?.inputUsdPer1M ?? AGENTS_MODEL_INPUT_USD_PER_1M}`);
  console.log(`  catalog output $/1M:     ${entry?.outputUsdPer1M ?? AGENTS_MODEL_OUTPUT_USD_PER_1M}`);
  console.log(`  margin:                  ${COMPUTE_CREDIT_MARGIN}`);
  console.log(`  input credits/token:     ${rates.inputCreditsPerToken}`);
  console.log(`  output credits/token:    ${rates.outputCreditsPerToken}`);
  console.log(
    `  formula:                 credits = tokensIn × ${rates.inputCreditsPerToken} + tokensOut × ${rates.outputCreditsPerToken}`,
  );
  console.log(
    `  10M credits ≈            ${(PRO_MONTHLY_COMPUTE_CREDIT_ALLOWANCE / rates.outputCreditsPerToken).toLocaleString()} output tokens`,
  );
  console.log("");
  console.log("Preflight estimates (typical in/out mix, not measured):\n");
  console.log("  depth  tokens              credits     vs Standard     vs Pro");

  for (const [depth, tokens] of Object.entries(ESTIMATED_TOKENS_BY_DEPTH)) {
    const credits = estimateAgentsModelCreditsFromTokenVolume(tokens);
    const stdRuns = Math.floor(
      (STANDARD_MONTHLY_COMPUTE_CREDIT_ALLOWANCE * 0.97) / credits,
    );
    const proRuns = Math.floor(
      (PRO_MONTHLY_COMPUTE_CREDIT_ALLOWANCE * 0.97) / credits,
    );
    console.log(
      `  ${depth.padEnd(5)} ${tokens.toLocaleString().padStart(9)}  → ${credits.toLocaleString().padStart(11)}    ~${stdRuns} runs         ~${proRuns} runs`,
    );
  }

  const sampleIn = 71_600;
  const sampleOut = 16_600;
  console.log("");
  console.log(`Shallow sample (2026-08-11): ${sampleIn.toLocaleString()} in + ${sampleOut.toLocaleString()} out`);
  console.log(`  billed = ${computeAgentsModelCredits(sampleIn, sampleOut).toLocaleString()} credits`);
  console.log("");
  console.log("Pro $19/mo is positioned 1:1 with a direct Anthropic monthly sub; 5% margin covers platform cost.");
}

main();
