-- Anthropic-only Agents Model + Standard/Pro plan pivot.
-- Manual apply only — do not auto-run in agent workflows.
--
-- Changes:
-- 1) Remap subscriptions byok→standard, hosted→pro
-- 2) plan_credit_configs for standard (3_333_333) and pro (10_000_000)
-- 3) Deactivate non-Agents Model multipliers; ensure claude-sonnet-5 active
-- 4) Deactivate non-anthropic platform keys
-- 5) Clear BYOK user_credentials (table kept for FK safety; app no longer uses it)
-- 6) sessions.archived_on for future Standard soft-hide retention job

-- ---------------------------------------------------------------------------
-- 1) Remap existing subscriptions
-- ---------------------------------------------------------------------------
update public.user_subscriptions
set plan_id = 'pro', updated_at = now()
where plan_id = 'hosted';

update public.user_subscriptions
set plan_id = 'standard', updated_at = now()
where plan_id = 'byok';

-- ---------------------------------------------------------------------------
-- 2) Plan credit configs
-- ---------------------------------------------------------------------------
insert into public.plan_credit_configs (
  plan_id,
  monthly_credit_allowance,
  low_balance_block_ratio,
  low_balance_warn_ratio,
  max_rollover_periods,
  estimated_tokens_by_depth,
  reference_output_usd_per_1m,
  updated_at
)
values
  (
    'standard',
    3333333,
    0.0300,
    0.1000,
    1,
    '{"1": 80000, "3": 250000, "5": 500000}'::jsonb,
    0.266667,
    now()
  ),
  (
    'pro',
    10000000,
    0.0300,
    0.1000,
    1,
    '{"1": 80000, "3": 250000, "5": 500000}'::jsonb,
    0.266667,
    now()
  )
on conflict (plan_id) do update set
  monthly_credit_allowance = excluded.monthly_credit_allowance,
  low_balance_block_ratio = excluded.low_balance_block_ratio,
  low_balance_warn_ratio = excluded.low_balance_warn_ratio,
  max_rollover_periods = excluded.max_rollover_periods,
  estimated_tokens_by_depth = excluded.estimated_tokens_by_depth,
  reference_output_usd_per_1m = excluded.reference_output_usd_per_1m,
  updated_at = now();

delete from public.plan_credit_configs
where plan_id in ('byok', 'hosted');

-- ---------------------------------------------------------------------------
-- 3) Model catalog — Agents Model only
-- ---------------------------------------------------------------------------
update public.model_credit_multipliers
set is_active = false, updated_at = now()
where not (provider_id = 'anthropic' and model_id = 'claude-sonnet-5');

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
  is_active,
  updated_at
)
values (
  'anthropic',
  'claude-sonnet-5',
  'Agents Model',
  'Anthropic',
  2,
  10,
  37.5,
  '["quick","deep"]'::jsonb,
  'Introductory pricing through 2026-08-31; then $3/$15. Product sole model.',
  true,
  now()
)
on conflict (provider_id, model_id) do update set
  display_name = excluded.display_name,
  provider_label = excluded.provider_label,
  input_usd_per_1m = excluded.input_usd_per_1m,
  output_usd_per_1m = excluded.output_usd_per_1m,
  credit_multiplier = excluded.credit_multiplier,
  modes = excluded.modes,
  notes = excluded.notes,
  is_active = true,
  updated_at = now();

-- ---------------------------------------------------------------------------
-- 4) Platform keys — Anthropic only
-- ---------------------------------------------------------------------------
update public.platform_api_keys
set is_active = false, updated_at = now()
where provider_id <> 'anthropic';

-- ---------------------------------------------------------------------------
-- 5) BYOK teardown (clear stored user keys; table remains but unused)
-- ---------------------------------------------------------------------------
delete from public.user_credentials;

comment on table public.user_credentials is
  'Retired: BYOK removed. Rows should remain empty; app uses platform Agents Model keys only.';

-- ---------------------------------------------------------------------------
-- 6) Future standard-plan soft archive column (no jobs in this migration)
-- ---------------------------------------------------------------------------
alter table public.sessions
  add column if not exists archived_on timestamptz;

comment on column public.sessions.archived_on is
  'Forward-compat: intended for Standard-plan soft-hide after retention. App does not set or filter this yet; null means visible.';

create index if not exists idx_sessions_user_id_visible
  on public.sessions (user_id, analysis_date desc, created_at desc)
  where deleted_on is null and archived_on is null;
