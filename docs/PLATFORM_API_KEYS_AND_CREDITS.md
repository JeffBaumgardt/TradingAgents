# Platform API keys & compute credits (manual ops)

Apply migrations in order:

1. `packages/supabase/supabase/migrations/20260722000000_credits_platform_keys.sql`
2. `packages/supabase/supabase/migrations/20260722010000_hosted_providers_openai_anthropic_google_xai.sql`
3. `packages/supabase/supabase/migrations/20260722120000_expand_hosted_model_catalog.sql` (if present)
4. `packages/supabase/supabase/migrations/20260722130000_credit_margin_5_percent.sql` (if present)
5. `packages/supabase/supabase/migrations/20260722140000_meter_atomic_and_hardening.sql`
6. `packages/supabase/supabase/migrations/20260722150000_sessions_soft_delete.sql` (if present)
7. `packages/supabase/supabase/migrations/20260722160000_meter_period_user_check.sql`
8. `packages/supabase/supabase/migrations/20260723000000_session_chat_messages.sql` (follow-up chat + usage_kind)

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

Each hosted run uses a **single model** (`thinkLlm`) for every agent. Compute
credits are `tokens × that model’s credit_multiplier` — there is no quick/deep
blend.

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

Refresh list prices + multipliers from LiteLLM (writes a migration under
`packages/supabase/supabase/migrations/` and prints SQL to stdout):

```bash
pnpm --filter @tradingagents/api sync-model-prices
pnpm --filter @tradingagents/api sync-model-prices -- --dry-run
```

Review the generated SQL against provider pricing pages (LiteLLM can lag), then apply
it in the Supabase SQL editor (or your usual migration path). Models LiteLLM cannot
resolve are left unchanged and logged.

## Security notes (abuse / inference theft)

Real-world AI apps get drained by bots and “power users” reselling inference ([Vercel on token theft](https://vercel.com/blog/protecting-against-token-theft), [WorkOS on LLM token theft](https://workos.com/blog/llm-token-theft)). Takeaways we encode here:

1. **Meter on the server for every hosted run**, not only when a browser is watching the SSE stream — session-only / UI-only checks amortize across thousands of LLM calls.
2. **Hard stop mid-run** when credits hit zero; keep partial output but mark the run failed. Metering errors fail closed (cancel the run).
3. **Block the rest of the credit period** when remaining credits fall under ~3% of allowance. Rejecting a single oversized estimate does **not** latch the period.
4. **Platform keys never leave the service role path** — RLS with no client policies; revoked from `anon`/`authenticated`; encrypted at rest; no public list API. Config resolve and model catalogs do **not** decrypt or forward platform keys (hosted providers are marked available from billing state; catalogs use the public static list).
5. **BYOK does not grant hosted credits** — user keys are `self_pay` (tokens tracked, credits = 0).
6. **Provider-side spend caps** are still required (OpenAI/Anthropic/Google/xAI dashboards). App metering contains abuse through your product; provider caps contain a leaked key used directly against the vendor.
7. **Client `backendUrl` is ignored for platform-key runs** — the API pins the official vendor endpoint so a malicious proxy cannot siphon `Authorization` headers (sidecar / “jack the prompts”).
8. **Hosted runs may only use curated catalog models** — custom / unknown model IDs are rejected so under-priced unknowns cannot drain provider spend against a cheap credit multiplier.
9. **Preflight subtracts in-flight hosted estimates** — concurrent session creates cannot each clear the same remaining balance.
10. **Metering refuses to charge another user’s credit period** (`user_id` must match on `user_credit_periods`).

## Follow-up Portfolio Manager chat

After a completed analysis, the **session owner** can continue a conversation with a
single Portfolio Manager agent grounded in stored research (no full pipeline re-run).

- Credits use the same token-delta meter (`usage_kind = follow_up` on the session cursor /
  usage events). BYOK remains `self_pay` (tokens recorded, credits = 0).
- An **active** BYOK or Hosted subscription is required to send messages. Cancelled /
  expired subscribers can still view the run and transcript.
- Share-by-link viewers can read the transcript; they cannot post or spend credits.
- Export: `GET /sessions/:id/export.md` downloads research + chat as markdown (clipboard
  size workaround).

## Rollover rule

Each **monthly credit window** (independent of Stripe annual vs monthly billing):

`rollover = max(0, previous.base_allowance - previous.used_credits)`

Prior rollover is **not** included, so unused credits cannot accumulate across many months.

Annual Stripe subscriptions still receive a fresh monthly allowance each month, anchored to the subscription period start’s UTC day-of-month.
