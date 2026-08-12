-- 1 credit = 1 Agents Model token. Recalibrate preflight token guesses from a
-- live shallow run (≈88.2k tokens). Manual apply only.

update public.model_credit_multipliers
set
  credit_multiplier = 1,
  notes = 'Product bills 1 credit per token. USD list price is operator-only.',
  updated_at = now()
where provider_id = 'anthropic'
  and model_id = 'claude-sonnet-5';

update public.plan_credit_configs
set
  estimated_tokens_by_depth = '{"1": 100000, "3": 280000, "5": 550000}'::jsonb,
  updated_at = now()
where plan_id in ('standard', 'pro');
