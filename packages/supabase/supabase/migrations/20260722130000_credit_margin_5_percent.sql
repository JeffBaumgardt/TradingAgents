-- Bake a 5% operator margin into hosted compute credits.
--
-- Before: 1 credit ≈ $0.28/1M output tokens → 10M credits ≈ $2.80 provider output.
-- After:  1 credit ≈ $0.28/1.05 ≈ $0.266667/1M → 10M credits ≈ $2.6667 provider output.
-- Same token usage burns ~5% more credits, leaving margin for personal/platform costs.
--
-- Multipliers are absolute (list output ÷ new reference), not a blind *1.05 on prior
-- rows, so this migration is idempotent with 20260722120000_expand_hosted_model_catalog.

update public.plan_credit_configs
set
  reference_output_usd_per_1m = 0.266667,
  updated_at = now()
where plan_id = 'hosted';

update public.model_credit_multipliers as m
set
  credit_multiplier = v.credit_multiplier,
  updated_at = now()
from (
  values
    ('openai', 'gpt-5.4-nano', 4.7),
    ('openai', 'gpt-5.4-mini', 16.9),
    ('openai', 'gpt-5-mini', 7.5),
    ('openai', 'gpt-4.1-mini', 6.0),
    ('openai', 'gpt-4o-mini', 2.3),
    ('openai', 'gpt-4.1', 30.0),
    ('openai', 'gpt-4o', 37.5),
    ('openai', 'gpt-5', 37.5),
    ('openai', 'gpt-5.2', 52.5),
    ('openai', 'gpt-5.4', 56.3),
    ('openai', 'gpt-5.5', 112.5),
    ('openai', 'o4-mini', 16.5),
    ('openai', 'o3', 30.0),
    ('anthropic', 'claude-haiku-4-5', 18.8),
    ('anthropic', 'claude-sonnet-4-5', 56.3),
    ('anthropic', 'claude-sonnet-4-6', 56.3),
    ('anthropic', 'claude-sonnet-5', 37.5),
    ('anthropic', 'claude-opus-4-5', 93.8),
    ('anthropic', 'claude-opus-4-6', 93.8),
    ('anthropic', 'claude-opus-4-7', 93.8),
    ('anthropic', 'claude-opus-4-8', 93.8),
    ('google', 'gemini-3.1-flash-lite', 5.6),
    ('google', 'gemini-3.5-flash-lite', 9.4),
    ('google', 'gemini-3-flash-preview', 11.3),
    ('google', 'gemini-3.5-flash', 33.8),
    ('google', 'gemini-3.1-pro-preview', 45.0),
    ('xai', 'grok-build-0.1', 7.5),
    ('xai', 'grok-4.20-0309-non-reasoning', 9.4),
    ('xai', 'grok-4.3', 9.4),
    ('xai', 'grok-4.20-0309-reasoning', 9.4),
    ('xai', 'grok-4.20-multi-agent-0309', 9.4),
    ('xai', 'grok-4.5', 22.5)
) as v(provider_id, model_id, credit_multiplier)
where m.provider_id = v.provider_id
  and m.model_id = v.model_id;
