-- Track scheduled cancellations (Stripe cancel_at_period_end) without ending
-- access early. Shared run links and existing sessions are intentionally
-- unaffected when a subscription ends.

alter table public.user_subscriptions
  add column if not exists cancel_at_period_end boolean not null default false;
