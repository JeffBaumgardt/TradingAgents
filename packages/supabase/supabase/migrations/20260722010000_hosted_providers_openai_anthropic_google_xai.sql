-- Hosted catalog is OpenAI / Anthropic / Google / xAI only.
-- Deactivate any DeepSeek (or other) rows if an earlier seed included them.

update public.model_credit_multipliers
set is_active = false, updated_at = now()
where provider_id not in ('openai', 'anthropic', 'google', 'xai');

update public.platform_api_keys
set is_active = false, updated_at = now()
where provider_id not in ('openai', 'anthropic', 'google', 'xai');
