#!/usr/bin/env tsx
/**
 * Fetch current list prices for hosted models and emit a Supabase migration when
 * input/output $/1M or credit multipliers need updating.
 *
 * Price source: LiteLLM public model catalog (https://api.litellm.ai/).
 * Multipliers: outputUsdPer1M ÷ COMPUTE_CREDIT_REFERENCE_OUTPUT_USD_PER_1M
 * (includes the 5% operator margin baked into that reference).
 *
 * Usage (from repo root):
 *   pnpm --filter @tradingagents/api sync-model-prices
 *   pnpm --filter @tradingagents/api sync-model-prices -- --dry-run
 *   pnpm --filter @tradingagents/api sync-model-prices -- --source catalog
 *
 * Options:
 *   --source db|catalog   Baseline prices (default: db when env is set, else catalog)
 *   --dry-run             Print SQL to stdout only; do not write a migration file
 *
 * Review generated SQL against provider pricing pages before applying — LiteLLM
 * can lag or use a different tier than our short-context hosted rates.
 */

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  COMPUTE_CREDIT_REFERENCE_OUTPUT_USD_PER_1M,
  HOSTED_MODEL_CATALOG,
  creditMultiplierFromOutputUsdPer1M,
  type HostedModelProviderId,
} from "@tradingagents/api-types";
import type { ModelCreditMultiplierRow } from "@tradingagents/supabase";

const LITELLM_CATALOG_BASE = "https://api.litellm.ai/model_catalog";
const PRICE_EPSILON = 0.000001;
const MULTIPLIER_EPSILON = 0.05;

/** Extra LiteLLM catalog IDs to try when the bare model_id is missing or prefixed. */
const LOOKUP_ALIASES: Record<string, string[]> = {
  "grok-4.3": ["xai/grok-4.3", "xai/grok-4.3-latest"],
  "grok-4.5": ["xai/grok-4.5", "xai/grok-4.5-latest"],
  "grok-4.20-0309-reasoning": [
    "xai/grok-4.20-0309-reasoning",
    "xai/grok-4.20-beta-0309-reasoning",
  ],
  "grok-4.20-0309-non-reasoning": [
    "xai/grok-4.20-beta-0309-non-reasoning",
    "xai/grok-4.20-0309-non-reasoning",
  ],
  "grok-4.20-multi-agent-0309": [
    "xai/grok-4.20-multi-agent-beta-0309",
    "xai/grok-4.20-multi-agent-0309",
  ],
  "gemini-3.5-flash": ["gemini/gemini-3.5-flash", "gemini-3.5-flash"],
  "gemini-3.5-flash-lite": [
    "gemini/gemini-3.5-flash-lite",
    "gemini-3.5-flash-lite",
  ],
  "gemini-3.1-flash-lite": [
    "gemini/gemini-3.1-flash-lite",
    "gemini-3.1-flash-lite",
  ],
  "gemini-3-flash-preview": [
    "gemini/gemini-3-flash-preview",
    "gemini-3-flash-preview",
  ],
  "gemini-3.1-pro-preview": [
    "gemini/gemini-3.1-pro-preview",
    "gemini-3.1-pro-preview",
  ],
};

interface BaselineRow {
  providerId: HostedModelProviderId;
  modelId: string;
  displayName: string;
  providerLabel: string;
  inputUsdPer1M: number;
  outputUsdPer1M: number;
  creditMultiplier: number;
  modes: string[];
  notes: string | null;
}

interface FetchedPrice {
  inputUsdPer1M: number;
  outputUsdPer1M: number;
  sourceId: string;
}

interface PriceChange {
  row: BaselineRow;
  nextInputUsdPer1M: number;
  nextOutputUsdPer1M: number;
  nextMultiplier: number;
  sourceId: string;
}

function readFlag(name: string): boolean {
  return process.argv.includes(name);
}

function readArg(flag: string): string | null {
  const index = process.argv.indexOf(flag);
  if (index < 0) {
    return null;
  }
  return process.argv[index + 1] ?? null;
}

function repoRootFromScript(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(here, "../../../../");
}

function migrationsDir(): string {
  return path.join(
    repoRootFromScript(),
    "packages/supabase/supabase/migrations",
  );
}

function sqlLiteral(value: string | null): string {
  if (value == null) {
    return "null";
  }
  return `'${value.replace(/'/g, "''")}'`;
}

function sqlNumber(value: number, digits: number): string {
  const fixed = Number(value.toFixed(digits));
  return Number.isInteger(fixed) ? String(fixed) : String(fixed);
}

function nearlyEqual(a: number, b: number, epsilon: number): boolean {
  return Math.abs(a - b) <= epsilon;
}

function migrationTimestamp(date = new Date()): string {
  const pad = (n: number, w = 2) => String(n).padStart(w, "0");
  return (
    `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}` +
    `${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`
  );
}

function asProviderId(value: string): HostedModelProviderId | null {
  if (
    value === "openai" ||
    value === "anthropic" ||
    value === "google" ||
    value === "xai"
  ) {
    return value;
  }
  return null;
}

function catalogBaseline(): BaselineRow[] {
  return HOSTED_MODEL_CATALOG.map((entry) => ({
    providerId: entry.providerId,
    modelId: entry.modelId,
    displayName: entry.displayName,
    providerLabel: entry.providerLabel,
    inputUsdPer1M: entry.inputUsdPer1M,
    outputUsdPer1M: entry.outputUsdPer1M,
    creditMultiplier: creditMultiplierFromOutputUsdPer1M(entry.outputUsdPer1M),
    modes: [...entry.modes],
    notes: entry.notes ?? null,
  }));
}

async function loadBaselineFromDb(): Promise<BaselineRow[]> {
  const url = process.env.SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SECRET_KEY?.trim();
  if (!url || !key) {
    throw new Error(
      "SUPABASE_URL and SUPABASE_SECRET_KEY are required for --source db",
    );
  }

  const endpoint =
    `${url.replace(/\/$/, "")}/rest/v1/model_credit_multipliers` +
    `?is_active=eq.true&select=*&order=provider_id,model_id`;
  const response = await fetch(endpoint, {
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      Accept: "application/json",
    },
  });
  if (!response.ok) {
    throw new Error(
      `Supabase read failed (${response.status}): ${await response.text()}`,
    );
  }

  const rows = (await response.json()) as ModelCreditMultiplierRow[];
  const baseline: BaselineRow[] = [];
  for (const row of rows) {
    const providerId = asProviderId(row.provider_id);
    if (!providerId) {
      continue;
    }
    baseline.push({
      providerId,
      modelId: row.model_id,
      displayName: row.display_name,
      providerLabel: row.provider_label,
      inputUsdPer1M: Number(row.input_usd_per_1m),
      outputUsdPer1M: Number(row.output_usd_per_1m),
      creditMultiplier: Number(row.credit_multiplier),
      modes: Array.isArray(row.modes) ? row.modes.map(String) : [],
      notes: row.notes,
    });
  }
  return baseline;
}

interface LiteLLMEntry {
  id: string;
  input_cost_per_token?: number | null;
  output_cost_per_token?: number | null;
}

async function fetchLiteLLMEntry(catalogId: string): Promise<LiteLLMEntry | null> {
  const response = await fetch(
    `${LITELLM_CATALOG_BASE}/${encodeURIComponent(catalogId)}`,
  );
  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    throw new Error(
      `LiteLLM lookup failed for ${catalogId} (${response.status})`,
    );
  }
  return (await response.json()) as LiteLLMEntry;
}

async function fetchLiteLLMProviderIndex(
  provider: string,
): Promise<Map<string, LiteLLMEntry>> {
  const index = new Map<string, LiteLLMEntry>();
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    const url = new URL(LITELLM_CATALOG_BASE);
    url.searchParams.set("provider", provider);
    url.searchParams.set("page", String(page));
    url.searchParams.set("page_size", "100");
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(
        `LiteLLM provider list failed for ${provider} (${response.status})`,
      );
    }
    const body = (await response.json()) as {
      data?: LiteLLMEntry[];
      has_more?: boolean;
    };
    for (const entry of body.data ?? []) {
      index.set(entry.id, entry);
      const bare = entry.id.includes("/")
        ? entry.id.slice(entry.id.lastIndexOf("/") + 1)
        : entry.id;
      if (!index.has(bare)) {
        index.set(bare, entry);
      }
    }
    hasMore = Boolean(body.has_more);
    page += 1;
    if (page > 20) {
      break;
    }
  }

  return index;
}

function entryToPrice(entry: LiteLLMEntry): FetchedPrice | null {
  const input = entry.input_cost_per_token;
  const output = entry.output_cost_per_token;
  if (
    typeof input !== "number" ||
    typeof output !== "number" ||
    !Number.isFinite(input) ||
    !Number.isFinite(output) ||
    input <= 0 ||
    output <= 0
  ) {
    return null;
  }
  return {
    inputUsdPer1M: input * 1_000_000,
    outputUsdPer1M: output * 1_000_000,
    sourceId: entry.id,
  };
}

function candidateIds(providerId: string, modelId: string): string[] {
  const aliases = LOOKUP_ALIASES[modelId] ?? [];
  return [
    modelId,
    `${providerId}/${modelId}`,
    ...aliases,
    // Google models are often listed under the gemini/ prefix in LiteLLM.
    ...(providerId === "google" ? [`gemini/${modelId}`] : []),
    ...(providerId === "xai" ? [`xai/${modelId}`] : []),
  ].filter((id, index, all) => all.indexOf(id) === index);
}

async function resolvePrice(
  providerId: string,
  modelId: string,
  providerIndexes: Map<string, Map<string, LiteLLMEntry>>,
): Promise<FetchedPrice | null> {
  const indexKeys =
    providerId === "google"
      ? ["gemini", "vertex_ai"]
      : providerId === "xai"
        ? ["xai"]
        : [providerId];

  for (const candidate of candidateIds(providerId, modelId)) {
    for (const key of indexKeys) {
      const hit = providerIndexes.get(key)?.get(candidate);
      if (hit) {
        const price = entryToPrice(hit);
        if (price) {
          return price;
        }
      }
    }
    const direct = await fetchLiteLLMEntry(candidate);
    if (direct) {
      const price = entryToPrice(direct);
      if (price) {
        return price;
      }
    }
  }
  return null;
}

function buildMigrationSql(changes: PriceChange[], generatedAt: Date): string {
  const lines: string[] = [
    `-- Sync model_credit_multipliers list prices from LiteLLM.`,
    `-- Generated by apps/api/src/scripts/sync-model-prices.ts on ${generatedAt.toISOString()}.`,
    `-- Credit reference (with margin): $${COMPUTE_CREDIT_REFERENCE_OUTPUT_USD_PER_1M.toFixed(6)} / 1M output tokens.`,
    `-- Review before applying.`,
    "",
  ];

  for (const change of changes) {
    lines.push(
      `-- ${change.row.providerId}/${change.row.modelId}` +
        `  input ${change.row.inputUsdPer1M} → ${change.nextInputUsdPer1M}` +
        `  output ${change.row.outputUsdPer1M} → ${change.nextOutputUsdPer1M}` +
        `  mult ${change.row.creditMultiplier} → ${change.nextMultiplier}` +
        `  (source: ${change.sourceId})`,
    );
    lines.push(`update public.model_credit_multipliers`);
    lines.push(`set`);
    lines.push(
      `  input_usd_per_1m = ${sqlNumber(change.nextInputUsdPer1M, 6)},`,
    );
    lines.push(
      `  output_usd_per_1m = ${sqlNumber(change.nextOutputUsdPer1M, 6)},`,
    );
    lines.push(
      `  credit_multiplier = ${sqlNumber(change.nextMultiplier, 1)},`,
    );
    lines.push(`  updated_at = now()`);
    lines.push(
      `where provider_id = ${sqlLiteral(change.row.providerId)}`,
    );
    lines.push(
      `  and model_id = ${sqlLiteral(change.row.modelId)};`,
    );
    lines.push("");
  }

  return `${lines.join("\n").trimEnd()}\n`;
}

async function main() {
  const dryRun = readFlag("--dry-run");
  const sourceArg = (readArg("--source") ?? "").toLowerCase();
  const hasDbEnv = Boolean(
    process.env.SUPABASE_URL?.trim() && process.env.SUPABASE_SECRET_KEY?.trim(),
  );
  const source =
    sourceArg === "db" || sourceArg === "catalog"
      ? sourceArg
      : hasDbEnv
        ? "db"
        : "catalog";

  console.error(
    `[sync-model-prices] baseline=${source} reference=$${COMPUTE_CREDIT_REFERENCE_OUTPUT_USD_PER_1M.toFixed(6)}/1M`,
  );

  const baseline =
    source === "db" ? await loadBaselineFromDb() : catalogBaseline();
  if (baseline.length === 0) {
    console.error("[sync-model-prices] no baseline models found");
    process.exit(1);
  }

  const providerIndexes = new Map<string, Map<string, LiteLLMEntry>>();
  for (const provider of ["openai", "anthropic", "gemini", "xai"]) {
    console.error(`[sync-model-prices] fetching LiteLLM provider=${provider}…`);
    providerIndexes.set(provider, await fetchLiteLLMProviderIndex(provider));
  }

  const changes: PriceChange[] = [];
  const unresolved: string[] = [];

  for (const row of baseline) {
    const price = await resolvePrice(
      row.providerId,
      row.modelId,
      providerIndexes,
    );
    if (!price) {
      unresolved.push(`${row.providerId}/${row.modelId}`);
      continue;
    }

    const nextMultiplier = creditMultiplierFromOutputUsdPer1M(
      price.outputUsdPer1M,
    );
    const inputChanged = !nearlyEqual(
      row.inputUsdPer1M,
      price.inputUsdPer1M,
      PRICE_EPSILON,
    );
    const outputChanged = !nearlyEqual(
      row.outputUsdPer1M,
      price.outputUsdPer1M,
      PRICE_EPSILON,
    );
    const multiplierChanged = !nearlyEqual(
      row.creditMultiplier,
      nextMultiplier,
      MULTIPLIER_EPSILON,
    );

    if (!inputChanged && !outputChanged && !multiplierChanged) {
      continue;
    }

    changes.push({
      row,
      nextInputUsdPer1M: price.inputUsdPer1M,
      nextOutputUsdPer1M: price.outputUsdPer1M,
      nextMultiplier,
      sourceId: price.sourceId,
    });
  }

  if (unresolved.length > 0) {
    console.error(
      `[sync-model-prices] unresolved (${unresolved.length}): ${unresolved.join(", ")}`,
    );
  }

  if (changes.length === 0) {
    console.error("[sync-model-prices] no price changes detected");
    process.exit(0);
  }

  const now = new Date();
  const sql = buildMigrationSql(changes, now);
  console.log(sql);

  if (dryRun) {
    console.error(
      `[sync-model-prices] dry-run: ${changes.length} change(s); migration not written`,
    );
    process.exit(0);
  }

  const filename = `${migrationTimestamp(now)}_sync_model_credit_prices.sql`;
  const outPath = path.join(migrationsDir(), filename);
  await mkdir(path.dirname(outPath), { recursive: true });
  await writeFile(outPath, sql, "utf8");
  console.error(`[sync-model-prices] wrote ${outPath}`);
  console.error(
    `[sync-model-prices] ${changes.length} model(s) changed — review and apply the migration`,
  );
}

main().catch((error) => {
  console.error("[sync-model-prices] failed:", error);
  process.exit(1);
});
