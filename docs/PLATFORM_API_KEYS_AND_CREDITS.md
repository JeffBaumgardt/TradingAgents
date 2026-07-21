# Platform API keys & compute credits (manual ops)

Apply migration:

`packages/supabase/supabase/migrations/20260722000000_credits_platform_keys.sql`

Do **not** paste plaintext provider keys into SQL. Keys must be stored as `enc:v1:` AES-GCM ciphertext using the same `CREDENTIALS_ENCRYPTION_KEY` as user credentials.

## Insert / rotate hosted platform keys

Preferred (prints ready-to-run SQL with `enc:v1:` ciphertext):

```bash
export CREDENTIALS_ENCRYPTION_KEY="..."   # same base64 key as the API

pnpm --filter @tradingagents/api exec tsx src/scripts/set-platform-api-key.ts \
  --provider openai \
  --key "sk-..." \
  --label "hosted-prod"
```

Copy the printed `INSERT ... ON CONFLICT` into the Supabase SQL editor and run it.

Repeat for each hosted provider you support:

| `provider_id` | Typical env equivalent |
|---------------|------------------------|
| `openai` | `OPENAI_API_KEY` |
| `anthropic` | `ANTHROPIC_API_KEY` |
| `google` | `GOOGLE_API_KEY` |
| `xai` | `XAI_API_KEY` |

Hosted providers are limited to OpenAI, Anthropic, Google, and xAI.

Verify (ciphertext only — never select expecting plaintext):

```sql
select provider_id, left(encrypted_api_key, 12) as prefix, is_active, label, updated_at
from public.platform_api_keys
order by provider_id;
```

Disable a key without deleting:

```sql
update public.platform_api_keys
set is_active = false, updated_at = now()
where provider_id = 'openai';
```

## Tweak credit matrix

```sql
-- Monthly allowance + low-balance block/warn ratios
update public.plan_credit_configs
set
  monthly_credit_allowance = 10000000,
  low_balance_block_ratio = 0.0300,  -- block new runs below 3% remaining
  low_balance_warn_ratio = 0.1000,   -- live warning below 10%
  max_rollover_periods = 1,          -- prior month only (never stack)
  updated_at = now()
where plan_id = 'hosted';

-- Per-model multipliers (frontier models should be much higher)
update public.model_credit_multipliers
set credit_multiplier = 107.1, updated_at = now()
where provider_id = 'openai' and model_id = 'gpt-5.5';
```

## Security notes (abuse / inference theft)

Real-world AI apps get drained by bots and “power users” reselling inference ([Vercel on token theft](https://vercel.com/blog/protecting-against-token-theft), [WorkOS on LLM token theft](https://workos.com/blog/llm-token-theft)). Takeaways we encode here:

1. **Meter on every stats frame**, not only at session start — session-only checks amortize across thousands of LLM calls.
2. **Hard stop mid-run** when credits hit zero; keep partial output but mark the run failed.
3. **Block the rest of the period** when remaining credits fall under ~3% of allowance (or below the estimated cost of a new run).
4. **Platform keys never leave the service role path** — RLS with no client policies; revoked from `anon`/`authenticated`; encrypted at rest; no public list API.
5. **BYOK does not grant hosted credits** — user keys are `self_pay` (tokens tracked, credits = 0).
6. **Provider-side spend caps** are still required (OpenAI/Anthropic/Google/xAI dashboards). App metering contains abuse through your product; provider caps contain a leaked key used directly against the vendor.

## Rollover rule

Each new billing period:

`rollover = max(0, previous.base_allowance - previous.used_credits)`

Prior rollover is **not** included, so unused credits cannot accumulate across many months.
