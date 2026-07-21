-- Atomic metering + hardening for hosted credits.
-- Apply after 20260722130000_credit_margin_5_percent.sql

-- ---------------------------------------------------------------------------
-- usage_events.cost_source constraint
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'usage_events_cost_source_check'
  ) then
    alter table public.usage_events
      add constraint usage_events_cost_source_check
      check (cost_source in ('hosted', 'self_pay'));
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Tighten grants on credit-related tables (service_role only via admin client)
-- ---------------------------------------------------------------------------
revoke all on table public.plan_credit_configs from anon, authenticated;
revoke all on table public.model_credit_multipliers from anon, authenticated;
revoke all on table public.user_credit_periods from anon, authenticated;
revoke all on table public.usage_events from anon, authenticated;

grant select, insert, update, delete on table public.plan_credit_configs to service_role;
grant select, insert, update, delete on table public.model_credit_multipliers to service_role;
grant select, insert, update, delete on table public.user_credit_periods to service_role;
grant select, insert, update, delete on table public.usage_events to service_role;
grant usage, select on sequence public.user_credit_periods_id_seq to service_role;
grant usage, select on sequence public.usage_events_id_seq to service_role;

-- ---------------------------------------------------------------------------
-- Atomic meter: lock cursor → charge → usage_event → advance cursor
-- ---------------------------------------------------------------------------
create or replace function public.meter_session_usage(
  p_session_id text,
  p_user_id text,
  p_tokens_in bigint,
  p_tokens_out bigint,
  p_period_id bigint,
  p_credit_multiplier numeric,
  p_warn_ratio numeric default 0.10
) returns table (
  charged_credits bigint,
  session_credits bigint,
  remaining_credits bigint,
  total_allowance bigint,
  used_ratio numeric,
  exhausted boolean,
  should_warn boolean,
  warn_message text,
  cost_source text,
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
  v_delta_credits bigint;
  v_charge bigint;
  v_total bigint;
  v_next_used bigint;
  v_remaining bigint;
  v_used_ratio numeric;
  v_exhausted boolean := false;
  v_should_warn boolean := false;
  v_warn text := null;
  v_model_id text;
  v_multiplier numeric := greatest(0, coalesce(p_credit_multiplier, 1));
begin
  select * into cursor_row
  from public.session_usage_cursors
  where session_id = p_session_id
  for update;

  if not found then
    return query select
      0::bigint, 0::bigint, null::bigint, null::bigint, null::numeric,
      false, false, null::text, 'self_pay'::text, 0::bigint, 0::bigint;
    return;
  end if;

  if cursor_row.user_id is distinct from p_user_id then
    raise exception 'session_usage_cursors user mismatch';
  end if;

  v_delta_in := greatest(0, v_tokens_in - cursor_row.last_tokens_in);
  v_delta_out := greatest(0, v_tokens_out - cursor_row.last_tokens_out);
  v_model_id := coalesce(nullif(cursor_row.deep_model_id, ''), cursor_row.quick_model_id);

  if v_delta_in = 0 and v_delta_out = 0 then
    if cursor_row.cost_source = 'hosted' and p_period_id is not null then
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
          cursor_row.cost_source,
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
      cursor_row.cost_source,
      0::bigint,
      0::bigint;
    return;
  end if;

  v_delta_credits := 0;
  v_charge := 0;
  v_remaining := null;
  v_total := null;
  v_used_ratio := null;

  if cursor_row.cost_source = 'hosted' then
    if p_period_id is null then
      raise exception 'hosted metering requires p_period_id';
    end if;

    select * into period_row
    from public.user_credit_periods
    where id = p_period_id
    for update;

    if not found then
      raise exception 'credit period % not found', p_period_id;
    end if;

    v_total := period_row.base_allowance + period_row.rollover_credits;
    v_delta_credits := round((v_delta_in + v_delta_out) * v_multiplier)::bigint;
    v_next_used := period_row.used_credits + v_delta_credits;

    if v_delta_credits > 0 and v_next_used > v_total then
      -- Soft overshoot: charge only what remains, then exhaust.
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
  end if;

  insert into public.usage_events (
    user_id,
    session_id,
    provider_id,
    model_id,
    tokens_in,
    tokens_out,
    billable_units,
    cost_source,
    credit_period_id,
    created_at
  ) values (
    p_user_id,
    p_session_id,
    cursor_row.provider_id,
    v_model_id,
    v_delta_in,
    v_delta_out,
    case when cursor_row.cost_source = 'hosted' then v_charge else 0 end,
    cursor_row.cost_source,
    p_period_id,
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
    cursor_row.cost_source,
    v_delta_in,
    v_delta_out;
end;
$$;

revoke all on function public.meter_session_usage(text, text, bigint, bigint, bigint, numeric, numeric)
  from public, anon, authenticated;
grant execute on function public.meter_session_usage(text, text, bigint, bigint, bigint, numeric, numeric)
  to service_role;
