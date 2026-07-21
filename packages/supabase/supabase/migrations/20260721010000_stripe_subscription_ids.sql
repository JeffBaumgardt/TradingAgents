-- Persist Stripe identifiers on subscriptions for Managed Payments checkout.

alter table public.user_subscriptions
  add column if not exists stripe_customer_id text,
  add column if not exists stripe_subscription_id text,
  add column if not exists stripe_checkout_session_id text;

create unique index if not exists user_subscriptions_stripe_subscription_id_uidx
  on public.user_subscriptions (stripe_subscription_id)
  where stripe_subscription_id is not null;

create index if not exists idx_user_subscriptions_stripe_customer_id
  on public.user_subscriptions (stripe_customer_id)
  where stripe_customer_id is not null;
