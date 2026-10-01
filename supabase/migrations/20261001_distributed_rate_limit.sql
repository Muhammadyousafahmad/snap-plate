-- Distributed (cross-replica) rate limiting for the analyze-meal Edge Function.
-- The function's in-memory limiter is per-instance, so a caller that lands on
-- several Edge Function replicas can exceed the intended 10 requests/minute.
-- This table + function give every replica one shared, atomic counter instead.

create table if not exists public.rate_limits (
  key text primary key,
  window_start timestamptz not null default now(),
  count integer not null default 0
);

-- Operational data, not user data: no RLS policies are defined, so every role
-- is denied by default. Only the service role (used by the Edge Function) gets
-- access, via the security-definer function below and a direct grant.
alter table public.rate_limits enable row level security;
revoke all on table public.rate_limits from anon, authenticated;
grant all on table public.rate_limits to service_role;

-- Atomically consumes one slot for `p_key` and reports whether the caller is
-- still within `p_max` requests per `p_window_seconds`. The `on conflict do
-- update` takes a row lock, so concurrent calls serialise on the key instead of
-- racing — which is what makes the count safe across replicas.
create or replace function public.check_rate_limit(
  p_key text,
  p_max integer,
  p_window_seconds integer
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := now();
  v_count integer;
begin
  insert into public.rate_limits as rl (key, window_start, count)
  values (p_key, v_now, 1)
  on conflict (key) do update
    set count = case
          when rl.window_start <= v_now - make_interval(secs => p_window_seconds)
            then 1
          else rl.count + 1
        end,
        window_start = case
          when rl.window_start <= v_now - make_interval(secs => p_window_seconds)
            then v_now
          else rl.window_start
        end
  returning rl.count into v_count;

  return v_count <= p_max;
end;
$$;

-- Reachable only by the service role (the Edge Function); keep it off the
-- public PostgREST API for anon/authenticated callers.
revoke all on function public.check_rate_limit(text, integer, integer) from public;
grant execute on function public.check_rate_limit(text, integer, integer) to service_role;

-- Supports periodic pruning of stale keys, e.g.
--   delete from public.rate_limits where window_start < now() - interval '1 day';
-- Rows are otherwise only ever touched again by their own still-active key.
create index if not exists rate_limits_window_start_idx
  on public.rate_limits (window_start);
