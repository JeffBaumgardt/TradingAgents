-- TradingAgents API schema (replaces SQLite persistence in apps/api)

create table if not exists public.sessions (
  id text primary key,
  ticker text not null,
  analysis_date text not null,
  status text not null,
  config jsonb not null,
  run_id text,
  report_markdown text,
  report_sections jsonb,
  decision text,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.events (
  id bigserial primary key,
  session_id text not null references public.sessions (id) on delete cascade,
  type text not null,
  payload jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_events_session_id on public.events (session_id);

create table if not exists public.users (
  id text primary key,
  email text,
  first_name text,
  last_name text,
  image_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_credentials (
  user_id text not null,
  provider_id text not null,
  field_name text not null,
  field_value text not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, provider_id, field_name)
);

alter table public.sessions enable row level security;
alter table public.events enable row level security;
alter table public.users enable row level security;
alter table public.user_credentials enable row level security;
