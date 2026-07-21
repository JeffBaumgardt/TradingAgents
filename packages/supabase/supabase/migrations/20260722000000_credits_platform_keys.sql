-- Compute credits, rollover, model multipliers, and hosted platform API keys.
-- Apply manually (do not run against production from the app).

-- ---------------------------------------------------------------------------
-- Plan-level credit matrix (tweak allowances / thresholds without code deploys)
-- ---------------------------------------------------------------------------
create table if not exists public.plan_credit_configs (
  plan_id text primary key,
  monthly_credit_allowance bigint not null,
  -- Block new hosted runs when remaining / total_allowance is below this ratio.
  low_balance_block_ratio numeric(6, 4) not null default 0.0300
    check (low_balance_block_ratio >= 0 and low_balance_block_ratio <= 1),
  -- Emit live warnings when remaining / total_allowance is below this ratio.
  low_balance_warn_ratio numeric(6, 4) not null default 0.1000
    check (low_balance_warn_ratio >= 0 and low_balance_warn_ratio <= 1),
  -- Only the immediately previous period may roll unused base credits forward.
  max_rollover_periods integer not null default 1
    check (max_rollover_periods >= 0 and max_rollover_periods <= 1),
  -- Rough token estimates by research_depth for pre-flight credit checks.
  estimated_tokens_by_depth jsonb not null default '{"1":80000,"3":250000,"5":500000}'::jsonb,
  reference_output_usd_per_1m numeric(12, 6) not null default 0.28,
  updated_at timestamptz not null default now()
);

alter table public.plan_credit_configs enable row level security;
-- No client policies: API reads via service_role (Clerk auth, not Supabase Auth).

insert into public.plan_credit_configs (
  plan_id,
  monthly_credit_allowance,
  low_balance_block_ratio,
  low_balance_warn_ratio,
  max_rollover_periods
) values
  ('hosted', 10000000, 0.0300, 0.1000, 1),
  ('byok', 0, 0.0300, 0.1000, 0)
on conflict (plan_id) do nothing;

-- ---------------------------------------------------------------------------
-- Model credit multipliers (DB-backed; seed mirrors hosted catalog)
-- ---------------------------------------------------------------------------
create table if not exists public.model_credit_multipliers (
  provider_id text not null,
  model_id text not null,
  display_name text not null,
  provider_label text not null,
  input_usd_per_1m numeric(12, 6) not null,
  output_usd_per_1m numeric(12, 6) not null,
  credit_multiplier numeric(12, 4) not null check (credit_multiplier > 0),
  modes jsonb not null default '[]'::jsonb,
  notes text,
  is_active boolean not null default true,
  updated_at timestamptz not null default now(),
  primary key (provider_id, model_id)
);

create index if not exists idx_model_credit_multipliers_active
  on public.model_credit_multipliers (is_active);

alter table public.model_credit_multipliers enable row level security;
-- No client policies: API serves catalog via service_role.

insert into public.model_credit_multipliers (
  provider_id,
  model_id,
  display_name,
  provider_label,
  input_usd_per_1m,
  output_usd_per_1m,
  credit_multiplier,
  modes,
  notes,
  is_active
) values
  ('openai', 'gpt-5.4-nano', 'GPT-5.4 Nano', 'OpenAI', 0.2, 1.25, 4.5, '["quick"]'::jsonb, null, true),
  ('openai', 'gpt-5.4-mini', 'GPT-5.4 Mini', 'OpenAI', 0.75, 4.5, 16.1, '["quick"]'::jsonb, null, true),
  ('openai', 'gpt-5-mini', 'GPT-5 Mini', 'OpenAI', 0.25, 2, 7.1, '["quick"]'::jsonb, null, true),
  ('openai', 'gpt-4.1-mini', 'GPT-4.1 Mini', 'OpenAI', 0.4, 1.6, 5.7, '["quick"]'::jsonb, null, true),
  ('openai', 'gpt-4o-mini', 'GPT-4o Mini', 'OpenAI', 0.15, 0.6, 2.1, '["quick"]'::jsonb, null, true),
  ('openai', 'gpt-4.1', 'GPT-4.1', 'OpenAI', 2, 8, 28.6, '["quick","deep"]'::jsonb, null, true),
  ('openai', 'gpt-4o', 'GPT-4o', 'OpenAI', 2.5, 10, 35.7, '["quick","deep"]'::jsonb, null, true),
  ('openai', 'gpt-5', 'GPT-5', 'OpenAI', 1.25, 10, 35.7, '["quick","deep"]'::jsonb, null, true),
  ('openai', 'gpt-5.2', 'GPT-5.2', 'OpenAI', 1.75, 14, 50, '["deep"]'::jsonb, null, true),
  ('openai', 'gpt-5.4', 'GPT-5.4', 'OpenAI', 2.5, 15, 53.6, '["deep"]'::jsonb, 'Short-context (<272K) standard tier.', true),
  ('openai', 'gpt-5.5', 'GPT-5.5', 'OpenAI', 5, 30, 107.1, '["deep"]'::jsonb, 'Short-context (<272K) standard tier.', true),
  ('openai', 'o4-mini', 'o4-mini', 'OpenAI', 1.1, 4.4, 15.7, '["deep"]'::jsonb, null, true),
  ('openai', 'o3', 'o3', 'OpenAI', 2, 8, 28.6, '["deep"]'::jsonb, null, true),
  ('anthropic', 'claude-haiku-4-5', 'Claude Haiku 4.5', 'Anthropic', 1, 5, 17.9, '["quick"]'::jsonb, null, true),
  ('anthropic', 'claude-sonnet-4-6', 'Claude Sonnet 4.6', 'Anthropic', 3, 15, 53.6, '["quick","deep"]'::jsonb, null, true),
  ('anthropic', 'claude-opus-4-6', 'Claude Opus 4.6', 'Anthropic', 5, 25, 89.3, '["deep"]'::jsonb, null, true),
  ('anthropic', 'claude-opus-4-7', 'Claude Opus 4.7', 'Anthropic', 5, 25, 89.3, '["deep"]'::jsonb, null, true),
  ('anthropic', 'claude-opus-4-8', 'Claude Opus 4.8', 'Anthropic', 5, 25, 89.3, '["deep"]'::jsonb, null, true),
  ('google', 'gemini-3.1-flash-lite', 'Gemini 3.1 Flash Lite', 'Google', 0.25, 1.5, 5.4, '["quick"]'::jsonb, null, true),
  ('google', 'gemini-3.5-flash', 'Gemini 3.5 Flash', 'Google', 1.5, 9, 32.1, '["quick","deep"]'::jsonb, null, true),
  ('google', 'gemini-3.1-pro-preview', 'Gemini 3.1 Pro', 'Google', 2, 12, 42.9, '["deep"]'::jsonb, '≤200K prompt tier; higher rates above 200K.', true),
  ('xai', 'grok-build-0.1', 'Grok Build 0.1', 'xAI', 1, 2, 7.1, '["quick"]'::jsonb, '≤200K prompt tier.', true),
  ('xai', 'grok-4.20-0309-non-reasoning', 'Grok 4.20 (Non-Reasoning)', 'xAI', 1.25, 2.5, 8.9, '["quick"]'::jsonb, '≤200K prompt tier.', true),
  ('xai', 'grok-4.3', 'Grok 4.3', 'xAI', 1.25, 2.5, 8.9, '["quick","deep"]'::jsonb, '≤200K prompt tier.', true),
  ('xai', 'grok-4.20-0309-reasoning', 'Grok 4.20 (Reasoning)', 'xAI', 1.25, 2.5, 8.9, '["deep"]'::jsonb, '≤200K prompt tier.', true),
  ('xai', 'grok-4.20-multi-agent-0309', 'Grok 4.20 Multi-Agent', 'xAI', 1.25, 2.5, 8.9, '["deep"]'::jsonb, '≤200K prompt tier.', true),
  ('xai', 'grok-4.5', 'Grok 4.5', 'xAI', 2, 6, 21.4, '["deep"]'::jsonb, '≤200K prompt tier.', true),
  ('deepseek', 'deepseek-v4-flash', 'DeepSeek V4 Flash', 'DeepSeek', 0.14, 0.28, 1, '["quick","deep"]'::jsonb, 'Input rate is cache-miss; cache-hit input is much lower.', true),
  ('deepseek', 'deepseek-v4-pro', 'DeepSeek V4 Pro', 'DeepSeek', 0.435, 0.87, 3.1, '["deep"]'::jsonb, 'Input rate is cache-miss; cache-hit input is much lower.', true)
on conflict (provider_id, model_id) do update set
  display_name = excluded.display_name,
  provider_label = excluded.provider_label,
  input_usd_per_1m = excluded.input_usd_per_1m,
  output_usd_per_1m = excluded.output_usd_per_1m,
  credit_multiplier = excluded.credit_multiplier,
  modes = excluded.modes,
  notes = excluded.notes,
  is_active = excluded.is_active,
  updated_at = now();

-- ---------------------------------------------------------------------------
-- Hosted platform API keys (service-role only; never readable by clients)
-- ---------------------------------------------------------------------------
create table if not exists public.platform_api_keys (
  provider_id text primary key,
  -- AES-GCM ciphertext with enc:v1: prefix (same scheme as user_credentials).
  encrypted_api_key text not null,
  label text,
  is_active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.platform_api_keys enable row level security;

-- Explicitly deny PostgREST roles. Only the service_role key (bypasses RLS)
-- used by the API gateway may read/write these rows.
revoke all on table public.platform_api_keys from anon, authenticated;
grant select, insert, update, delete on table public.platform_api_keys to service_role;

-- ---------------------------------------------------------------------------
-- Per-user credit periods (base + one-month rollover + usage + block flag)
-- ---------------------------------------------------------------------------
create table if not exists public.user_credit_periods (
  id bigserial primary key,
  user_id text not null references public.users (id) on delete cascade,
  period_start timestamptz not null,
  period_end timestamptz not null,
  base_allowance bigint not null default 0 check (base_allowance >= 0),
  -- Unused base credits from the immediately previous period only (never stacks).
  rollover_credits bigint not null default 0 check (rollover_credits >= 0),
  used_credits bigint not null default 0 check (used_credits >= 0),
  blocked_low_balance boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_credit_periods_range check (period_end > period_start),
  constraint user_credit_periods_user_start unique (user_id, period_start)
);

create index if not exists idx_user_credit_periods_user_end
  on public.user_credit_periods (user_id, period_end desc);

alter table public.user_credit_periods enable row level security;
-- No client policies: balances are exposed only through the authenticated API.

-- ---------------------------------------------------------------------------
-- Session metering cursor (delta tokens → usage_events without double-counting)
-- ---------------------------------------------------------------------------
create table if not exists public.session_usage_cursors (
  session_id text primary key references public.sessions (id) on delete cascade,
  user_id text not null references public.users (id) on delete cascade,
  provider_id text not null,
  quick_model_id text not null,
  deep_model_id text not null,
  cost_source text not null check (cost_source in ('hosted', 'self_pay')),
  last_tokens_in bigint not null default 0,
  last_tokens_out bigint not null default 0,
  credits_charged bigint not null default 0,
  low_credit_warned boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.session_usage_cursors enable row level security;

revoke all on table public.session_usage_cursors from anon, authenticated;
grant select, insert, update, delete on table public.session_usage_cursors to service_role;

-- ---------------------------------------------------------------------------
-- usage_events: link to credit period + ensure cost_source constraint
-- ---------------------------------------------------------------------------
alter table public.usage_events
  add column if not exists credit_period_id bigint references public.user_credit_periods (id) on delete set null;

create index if not exists idx_usage_events_period
  on public.usage_events (credit_period_id);

-- ---------------------------------------------------------------------------
-- Atomic credit charge (fail-closed when exhausted)
-- ---------------------------------------------------------------------------
create or replace function public.charge_user_credits(
  p_period_id bigint,
  p_credits bigint
) returns table (
  allowed boolean,
  used_credits bigint,
  remaining_credits bigint,
  total_allowance bigint,
  blocked_low_balance boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  period_row public.user_credit_periods%rowtype;
  total bigint;
  next_used bigint;
begin
  if p_credits < 0 then
    raise exception 'p_credits must be >= 0';
  end if;

  select * into period_row
  from public.user_credit_periods
  where id = p_period_id
  for update;

  if not found then
    raise exception 'credit period % not found', p_period_id;
  end if;

  total := period_row.base_allowance + period_row.rollover_credits;
  next_used := period_row.used_credits + p_credits;

  if p_credits > 0 and next_used > total then
    return query
      select
        false,
        period_row.used_credits,
        greatest(0, total - period_row.used_credits),
        total,
        period_row.blocked_low_balance;
    return;
  end if;

  update public.user_credit_periods
  set
    used_credits = next_used,
    updated_at = now()
  where id = p_period_id
  returning * into period_row;

  total := period_row.base_allowance + period_row.rollover_credits;
  return query
    select
      true,
      period_row.used_credits,
      greatest(0, total - period_row.used_credits),
      total,
      period_row.blocked_low_balance;
end;
$$;

revoke all on function public.charge_user_credits(bigint, bigint) from public, anon, authenticated;
grant execute on function public.charge_user_credits(bigint, bigint) to service_role;
