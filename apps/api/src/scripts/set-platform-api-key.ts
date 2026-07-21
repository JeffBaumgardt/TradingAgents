#!/usr/bin/env tsx
/**
 * Encrypt a hosted platform provider API key for manual SQL insert.
 *
 * Usage:
 *   CREDENTIALS_ENCRYPTION_KEY=... \
 *     pnpm --filter @tradingagents/api exec tsx src/scripts/set-platform-api-key.ts \
 *       --provider openai --key sk-... [--label prod]
 *
 * Paste the printed SQL into the Supabase SQL editor (service role / dashboard).
 * Never commit plaintext keys.
 */

import { encryptSecret } from "../lib/credentials-encryption.js";

function readArg(flag: string): string | null {
  const index = process.argv.indexOf(flag);
  if (index < 0) {
    return null;
  }
  return process.argv[index + 1] ?? null;
}

function sqlLiteral(value: string | null): string {
  if (value == null) {
    return "null";
  }
  return `'${value.replace(/'/g, "''")}'`;
}

function main() {
  const provider = (readArg("--provider") ?? "").toLowerCase().trim();
  const apiKey = (readArg("--key") ?? "").trim();
  const label = readArg("--label");
  const notes = readArg("--notes");

  if (!provider || !apiKey) {
    console.error(
      "Usage: set-platform-api-key.ts --provider <id> --key <secret> [--label <label>] [--notes <text>]",
    );
    process.exit(1);
  }

  if (!process.env.CREDENTIALS_ENCRYPTION_KEY?.trim()) {
    console.error("CREDENTIALS_ENCRYPTION_KEY is required");
    process.exit(1);
  }

  const ciphertext = encryptSecret(apiKey);
  const sql = `insert into public.platform_api_keys (
  provider_id,
  encrypted_api_key,
  label,
  notes,
  is_active,
  updated_at
) values (
  ${sqlLiteral(provider)},
  ${sqlLiteral(ciphertext)},
  ${sqlLiteral(label)},
  ${sqlLiteral(notes)},
  true,
  now()
)
on conflict (provider_id) do update set
  encrypted_api_key = excluded.encrypted_api_key,
  label = excluded.label,
  notes = excluded.notes,
  is_active = true,
  updated_at = now();`;

  console.log(sql);
}

main();
