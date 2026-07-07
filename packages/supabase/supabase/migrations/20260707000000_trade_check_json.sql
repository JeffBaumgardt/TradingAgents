-- Distilled Trade Check report artifact (structured JSON for quick-view UI + print export)

alter table public.sessions
  add column if not exists trade_check_json jsonb;

comment on column public.sessions.trade_check_json is
  'Structured Trade Check distillation: levels, scenarios, citations, chart series, agent sections';
