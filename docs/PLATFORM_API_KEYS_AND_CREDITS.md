# Platform API keys & compute credits (Standard / Pro)

Product runs use a single **Agents Model** (`anthropic` / `claude-sonnet-5`).
There is no BYOK and no multi-provider catalog on product plans.

## Plans

| Plan | Monthly credits | ≈ output | Price (list) |
|------|-----------------|----------|--------------|
| Standard | 3,333,333 | ~0.67M | $9 |
| Pro | 10,000,000 | ~2M | $19 |

Pro at $19/mo is positioned 1:1 with a direct Anthropic monthly sub. A 5%
margin is baked into the token→credit conversion so a full Pro allowance is
about $19 of list-price inference (not $20 of raw 2M output).

Annual is 20% off. Both plans include a **14-day free trial** with **no credit card**
(tokens/credits still count toward the allowance). Stripe checkout is only used when
converting to a paid subscription.

Apply migrations in order through the latest `*_platform_only_usage.sql`.
Do **not** paste plaintext provider keys into SQL. Keys must be stored as `enc:v1:`
AES-GCM ciphertext using `CREDENTIALS_ENCRYPTION_KEY`.

## Insert / rotate Anthropic platform key

```bash
export CREDENTIALS_ENCRYPTION_KEY="..."   # same base64 key as the API

pnpm --filter @tradingagents/api exec tsx src/scripts/set-platform-api-key.ts \
  --provider anthropic \
  --key "sk-ant-..." \
  --label "agents-prod"
```

Copy the printed `INSERT ... ON CONFLICT` into the Supabase SQL editor and run it.

Verify:

```sql
select provider_id, left(encrypted_api_key, 12) as prefix, is_active, label, updated_at
from public.platform_api_keys
order by provider_id;
```

Non-Anthropic platform keys should be `is_active = false` after the pivot migration.

## Credit matrix

```sql
update public.plan_credit_configs
set monthly_credit_allowance = 3333333, updated_at = now()
where plan_id = 'standard';

update public.plan_credit_configs
set monthly_credit_allowance = 10000000, updated_at = now()
where plan_id = 'pro';
```

Credits hide the input/output split: `credits = tokens_in × 1.05 + tokens_out × 5.25`
(1 input token = 1 credit, 1 output token = 5 credits from the $2 / $10 list
prices, then 5% platform margin). 10M Pro credits ≈ 2M output tokens. There is
no BYOK / self-pay path.

## Stripe env

Create Standard and Pro price objects, then set:

- `STRIPE_PRICE_STANDARD_MONTHLY`
- `STRIPE_PRICE_STANDARD_ANNUAL`
- `STRIPE_PRICE_PRO_MONTHLY`
- `STRIPE_PRICE_PRO_ANNUAL`

## Security notes

1. Meter on the server for every run; hard-stop when credits hit zero.
2. Block the period below ~3% remaining allowance; warn at ~10%.
3. Platform keys never leave the service-role path.
4. Client `backendUrl` is ignored — API pins Anthropic’s official endpoint.
5. Product runs always force `llmProvider=anthropic` and `thinkLlm=claude-sonnet-5`.

## Future work (not implemented here)

- Soft-archive Standard reports after 7 days (`sessions.archived_on`); restore on Pro upgrade.
- Transactional email: trial ending, low/exceeded credits, report complete (+ optional md attach).

## Rollover

`rollover = max(0, previous.base_allowance - previous.used_credits)` — prior rollover does not stack.
