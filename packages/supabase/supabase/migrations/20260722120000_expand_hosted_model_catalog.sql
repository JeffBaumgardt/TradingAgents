-- Expand hosted model_credit_multipliers to match HOSTED_MODEL_CATALOG (2026-07-21).
-- Adds Claude Sonnet 5 / Opus 4.5 / Sonnet 4.5, Gemini 3.5 Flash-Lite + 3 Flash,
-- and refreshes modes/prices for existing rows. BYOK-only ultra-premium SKUs
-- (gpt-5.5-pro, claude-fable-5) are intentionally omitted.
--
-- Credit multipliers include a 5% operator margin vs list output $/1M
-- (reference ≈ $0.2667/1M = $0.28 / 1.05). See
-- 20260722130000_credit_margin_5_percent.sql for the plan_credit_configs update.

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
  ('openai', 'gpt-5.4-nano', 'GPT-5.4 Nano', 'OpenAI', 0.2, 1.25, 4.7, '["quick"]'::jsonb, null, true),
  ('openai', 'gpt-5.4-mini', 'GPT-5.4 Mini', 'OpenAI', 0.75, 4.5, 16.9, '["quick"]'::jsonb, null, true),
  ('openai', 'gpt-5-mini', 'GPT-5 Mini', 'OpenAI', 0.25, 2, 7.5, '["quick"]'::jsonb, null, true),
  ('openai', 'gpt-4.1-mini', 'GPT-4.1 Mini', 'OpenAI', 0.4, 1.6, 6.0, '["quick"]'::jsonb, null, true),
  ('openai', 'gpt-4o-mini', 'GPT-4o Mini', 'OpenAI', 0.15, 0.6, 2.3, '["quick"]'::jsonb, null, true),
  ('openai', 'gpt-4.1', 'GPT-4.1', 'OpenAI', 2, 8, 30.0, '["quick","deep"]'::jsonb, null, true),
  ('openai', 'gpt-4o', 'GPT-4o', 'OpenAI', 2.5, 10, 37.5, '["quick","deep"]'::jsonb, null, true),
  ('openai', 'gpt-5', 'GPT-5', 'OpenAI', 1.25, 10, 37.5, '["quick","deep"]'::jsonb, null, true),
  ('openai', 'gpt-5.2', 'GPT-5.2', 'OpenAI', 1.75, 14, 52.5, '["deep"]'::jsonb, null, true),
  ('openai', 'gpt-5.4', 'GPT-5.4', 'OpenAI', 2.5, 15, 56.3, '["deep"]'::jsonb, 'Short-context (<272K) standard tier.', true),
  ('openai', 'gpt-5.5', 'GPT-5.5', 'OpenAI', 5, 30, 112.5, '["quick","deep"]'::jsonb, 'Short-context (<272K) standard tier.', true),
  ('openai', 'o4-mini', 'o4-mini', 'OpenAI', 1.1, 4.4, 16.5, '["deep"]'::jsonb, null, true),
  ('openai', 'o3', 'o3', 'OpenAI', 2, 8, 30.0, '["deep"]'::jsonb, null, true),
  ('anthropic', 'claude-haiku-4-5', 'Claude Haiku 4.5', 'Anthropic', 1, 5, 18.8, '["quick"]'::jsonb, null, true),
  ('anthropic', 'claude-sonnet-4-5', 'Claude Sonnet 4.5', 'Anthropic', 3, 15, 56.3, '["quick","deep"]'::jsonb, null, true),
  ('anthropic', 'claude-sonnet-4-6', 'Claude Sonnet 4.6', 'Anthropic', 3, 15, 56.3, '["quick","deep"]'::jsonb, null, true),
  ('anthropic', 'claude-sonnet-5', 'Claude Sonnet 5', 'Anthropic', 2, 10, 37.5, '["quick","deep"]'::jsonb, 'Introductory pricing through 2026-08-31; then $3/$15.', true),
  ('anthropic', 'claude-opus-4-5', 'Claude Opus 4.5', 'Anthropic', 5, 25, 93.8, '["deep"]'::jsonb, null, true),
  ('anthropic', 'claude-opus-4-6', 'Claude Opus 4.6', 'Anthropic', 5, 25, 93.8, '["deep"]'::jsonb, null, true),
  ('anthropic', 'claude-opus-4-7', 'Claude Opus 4.7', 'Anthropic', 5, 25, 93.8, '["deep"]'::jsonb, null, true),
  ('anthropic', 'claude-opus-4-8', 'Claude Opus 4.8', 'Anthropic', 5, 25, 93.8, '["deep"]'::jsonb, null, true),
  ('google', 'gemini-3.1-flash-lite', 'Gemini 3.1 Flash Lite', 'Google', 0.25, 1.5, 5.6, '["quick"]'::jsonb, null, true),
  ('google', 'gemini-3.5-flash-lite', 'Gemini 3.5 Flash-Lite', 'Google', 0.3, 2.5, 9.4, '["quick"]'::jsonb, null, true),
  ('google', 'gemini-3-flash-preview', 'Gemini 3 Flash', 'Google', 0.5, 3, 11.3, '["quick","deep"]'::jsonb, null, true),
  ('google', 'gemini-3.5-flash', 'Gemini 3.5 Flash', 'Google', 1.5, 9, 33.8, '["quick","deep"]'::jsonb, null, true),
  ('google', 'gemini-3.1-pro-preview', 'Gemini 3.1 Pro', 'Google', 2, 12, 45.0, '["deep"]'::jsonb, '≤200K prompt tier; higher rates above 200K.', true),
  ('xai', 'grok-build-0.1', 'Grok Build 0.1', 'xAI', 1, 2, 7.5, '["quick"]'::jsonb, '≤200K prompt tier.', true),
  ('xai', 'grok-4.20-0309-non-reasoning', 'Grok 4.20 (Non-Reasoning)', 'xAI', 1.25, 2.5, 9.4, '["quick"]'::jsonb, '≤200K prompt tier.', true),
  ('xai', 'grok-4.3', 'Grok 4.3', 'xAI', 1.25, 2.5, 9.4, '["quick","deep"]'::jsonb, '≤200K prompt tier.', true),
  ('xai', 'grok-4.20-0309-reasoning', 'Grok 4.20 (Reasoning)', 'xAI', 1.25, 2.5, 9.4, '["deep"]'::jsonb, '≤200K prompt tier.', true),
  ('xai', 'grok-4.20-multi-agent-0309', 'Grok 4.20 Multi-Agent', 'xAI', 1.25, 2.5, 9.4, '["deep"]'::jsonb, '≤200K prompt tier.', true),
  ('xai', 'grok-4.5', 'Grok 4.5', 'xAI', 2, 6, 22.5, '["deep"]'::jsonb, '≤200K prompt tier.', true)
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

-- Keep hosted catalog scoped to OpenAI / Anthropic / Google / xAI.
update public.model_credit_multipliers
set is_active = false, updated_at = now()
where provider_id not in ('openai', 'anthropic', 'google', 'xai');
