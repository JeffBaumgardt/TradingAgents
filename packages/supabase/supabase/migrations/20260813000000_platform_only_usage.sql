-- Platform-only usage: drop hosted vs self_pay.
-- All product traffic is billed against the plan credit period.
-- Metering: credits = tokens_in × input_rate + tokens_out × output_rate
-- (API passes 1.05 / 5.25 = 1 and 5 after 5% margin).
-- Generate-only; apply in the Supabase SQL editor (do not auto-apply).

drop function if exists public.meter_session_usage(text, text, bigint, bigint, bigint, numeric, numeric);
drop function if exists public.meter_session_usage(text, text, bigint, bigint, bigint, numeric, numeric, numeric);

alter table public.usage_events
  drop column if exists cost_source;

alter table public.session_usage_cursors
  drop column if exists cost_source;

create function public.meter_session_usage(
  p_session_id text,
  p_user_id text,
  p_tokens_in bigint,
  p_tokens_out bigint,
  p_period_id bigint,
  p_input_credits_per_token numeric,
  p_output_credits_per_token numeric,
  p_warn_ratio numeric
)
returns table (
  charged_credits bigint,
  session_credits bigint,
  remaining_credits bigint,
  total_allowance bigint,
  used_ratio numeric,
  exhausted boolean,
  should_warn boolean,
  warn_message text,
  delta_tokens_in bigint,
  delta_tokens_out bigint
)
language plpgsql
security definer
set search_path = public
as $$
declare
  cursor_row public.session_usage_cursors%rowtype;
  period_row public.user_credit_periods%rowtype;
  v_tokens_in bigint := greatest(0, coalesce(p_tokens_in, 0));
  v_tokens_out bigint := greatest(0, coalesce(p_tokens_out, 0));
  v_delta_in bigint;
  v_delta_out bigint;
  v_model_id text;
  v_delta_credits bigint;
  v_charge bigint := 0;
  v_remaining bigint;
  v_total bigint;
  v_used_ratio numeric;
  v_exhausted boolean := false;
  v_should_warn boolean := false;
  v_warn text := null;
  v_next_used bigint;
  v_input_rate numeric := greatest(0, coalesce(p_input_credits_per_token, 1));
  v_output_rate numeric := greatest(0, coalesce(p_output_credits_per_token, 5));
  v_usage_kind text;
begin
  select * into cursor_row
  from public.session_usage_cursors
  where session_id = p_session_id
  for update;

  if not found then
    return query select
      0::bigint, 0::bigint, null::bigint, null::bigint, null::numeric,
      false, false, null::text, 0::bigint, 0::bigint;
    return;
  end if;

  if cursor_row.user_id is distinct from p_user_id then
    raise exception 'session_usage_cursors user mismatch';
  end if;

  v_usage_kind := coalesce(nullif(cursor_row.usage_kind, ''), 'analysis_run');
  v_delta_in := greatest(0, v_tokens_in - cursor_row.last_tokens_in);
  v_delta_out := greatest(0, v_tokens_out - cursor_row.last_tokens_out);
  v_model_id := coalesce(nullif(cursor_row.deep_model_id, ''), cursor_row.quick_model_id);

  if v_delta_in = 0 and v_delta_out = 0 then
    if p_period_id is not null then
      select * into period_row
      from public.user_credit_periods
      where id = p_period_id
      for update;
      if found then
        v_total := period_row.base_allowance + period_row.rollover_credits;
        v_remaining := greatest(0, v_total - period_row.used_credits);
        v_used_ratio := case when v_total > 0 then least(1, period_row.used_credits::numeric / v_total) else 1 end;
        return query select
          0::bigint,
          cursor_row.credits_charged,
          v_remaining,
          v_total,
          v_used_ratio,
          false,
          false,
          null::text,
          0::bigint,
          0::bigint;
        return;
      end if;
    end if;

    return query select
      0::bigint,
      cursor_row.credits_charged,
      null::bigint,
      null::bigint,
      null::numeric,
      false,
      false,
      null::text,
      0::bigint,
      0::bigint;
    return;
  end if;

  if p_period_id is null then
    raise exception 'metering requires p_period_id';
  end if;

  select * into period_row
  from public.user_credit_periods
  where id = p_period_id
  for update;

  if not found then
    raise exception 'credit period % not found', p_period_id;
  end if;

  v_total := period_row.base_allowance + period_row.rollover_credits;
  v_delta_credits := round(
    v_delta_in * v_input_rate + v_delta_out * v_output_rate
  )::bigint;
  v_next_used := period_row.used_credits + v_delta_credits;

  if v_delta_credits > 0 and v_next_used > v_total then
    v_charge := greatest(0, v_total - period_row.used_credits);
    v_exhausted := true;
  else
    v_charge := v_delta_credits;
    v_exhausted := (v_total - (period_row.used_credits + v_charge)) <= 0;
  end if;

  update public.user_credit_periods
  set
    used_credits = used_credits + v_charge,
    blocked_low_balance = blocked_low_balance or v_exhausted,
    updated_at = now()
  where id = p_period_id
  returning * into period_row;

  v_total := period_row.base_allowance + period_row.rollover_credits;
  v_remaining := greatest(0, v_total - period_row.used_credits);
  v_used_ratio := case when v_total > 0 then least(1, period_row.used_credits::numeric / v_total) else 1 end;

  if (
    not cursor_row.low_credit_warned
    and not v_exhausted
    and v_total > 0
    and v_remaining::numeric / v_total <= greatest(0, coalesce(p_warn_ratio, 0.10))
  ) then
    v_should_warn := true;
    v_warn := format(
      'Compute credits are running low — %s of %s remaining this period.',
      to_char(v_remaining, 'FM999,999,999,999'),
      to_char(v_total, 'FM999,999,999,999')
    );
  end if;

  insert into public.usage_events (
    user_id,
    session_id,
    provider_id,
    model_id,
    tokens_in,
    tokens_out,
    billable_units,
    credit_period_id,
    usage_kind,
    created_at
  ) values (
    p_user_id,
    p_session_id,
    cursor_row.provider_id,
    v_model_id,
    v_delta_in,
    v_delta_out,
    v_charge,
    p_period_id,
    v_usage_kind,
    now()
  );

  update public.session_usage_cursors
  set
    last_tokens_in = v_tokens_in,
    last_tokens_out = v_tokens_out,
    credits_charged = credits_charged + v_charge,
    low_credit_warned = low_credit_warned or v_should_warn,
    updated_at = now()
  where session_id = p_session_id
  returning * into cursor_row;

  return query select
    v_charge,
    cursor_row.credits_charged,
    v_remaining,
    v_total,
    v_used_ratio,
    v_exhausted,
    v_should_warn,
    v_warn,
    v_delta_in,
    v_delta_out;
end;
$$;

revoke all on function public.meter_session_usage(text, text, bigint, bigint, bigint, numeric, numeric, numeric)
  from public, anon, authenticated;
grant execute on function public.meter_session_usage(text, text, bigint, bigint, bigint, numeric, numeric, numeric)
  to service_role;

-- Credits: 1 input token = 1 credit, 1 output token = 5 credits, then 5% margin
-- in the API. 10M credits ≈ 2M output tokens. List output price is $10/1M.
update public.plan_credit_configs
set
  reference_output_usd_per_1m = 10,
  updated_at = now()
where plan_id in ('standard', 'pro');

update public.model_credit_multipliers
set
  notes = 'Product bills 1 credit per input token and 5 per output token, plus 5% margin. USD list price is operator-only.',
  updated_at = now()
where provider_id = 'anthropic'
  and model_id = 'claude-sonnet-5';
