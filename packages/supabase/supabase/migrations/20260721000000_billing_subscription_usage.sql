-- Subscription + usage metering scaffold for hosted-plan allowances.
-- Stripe (or similar) will own payment state later; these tables track plan + usage.

create table if not exists public.user_subscriptions (
  user_id text primary key references public.users (id) on delete cascade,
  plan_id text not null,
  interval text not null,
  status text not null,
  current_period_start timestamptz not null,
  current_period_end timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_subscriptions enable row level security;

create table if not exists public.usage_events (
  id bigserial primary key,
  user_id text not null references public.users (id) on delete cascade,
  session_id text,
  provider_id text not null,
  model_id text not null,
  tokens_in bigint not null default 0,
  tokens_out bigint not null default 0,
  billable_units bigint not null default 0,
  cost_source text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_usage_events_user_period
  on public.usage_events (user_id, created_at);

alter table public.usage_events enable row level security;
