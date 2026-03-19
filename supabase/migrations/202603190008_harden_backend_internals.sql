create table if not exists public.request_rate_limits (
  bucket text not null,
  subject text not null,
  window_started_at timestamptz not null,
  request_count integer not null default 0 check (request_count >= 0),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (bucket, subject)
);

create index if not exists request_rate_limits_updated_at_idx
  on public.request_rate_limits (updated_at);

alter table public.request_rate_limits enable row level security;

drop policy if exists request_rate_limits_service_access on public.request_rate_limits;
create policy request_rate_limits_service_access
on public.request_rate_limits
for all
to service_role
using (true)
with check (true);

create or replace function public.check_request_rate_limit(
  p_bucket text,
  p_subject text,
  p_max_requests integer,
  p_window_seconds integer
)
returns table (
  allowed boolean,
  retry_after integer,
  remaining integer,
  reset_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := timezone('utc', now());
  v_window_size integer := greatest(coalesce(p_window_seconds, 60), 1);
  v_window_start timestamptz;
  v_window_end timestamptz;
  v_count integer;
begin
  if coalesce(length(trim(p_bucket)), 0) = 0 then
    raise exception 'p_bucket is required';
  end if;

  if coalesce(length(trim(p_subject)), 0) = 0 then
    raise exception 'p_subject is required';
  end if;

  if coalesce(p_max_requests, 0) <= 0 then
    raise exception 'p_max_requests must be greater than zero';
  end if;

  v_window_start :=
    to_timestamp(floor(extract(epoch from v_now) / v_window_size) * v_window_size);
  v_window_end := v_window_start + make_interval(secs => v_window_size);

  insert into public.request_rate_limits as rl (
    bucket,
    subject,
    window_started_at,
    request_count,
    updated_at
  )
  values (
    trim(p_bucket),
    trim(p_subject),
    v_window_start,
    1,
    v_now
  )
  on conflict (bucket, subject) do update
  set
    window_started_at = excluded.window_started_at,
    request_count = case
      when rl.window_started_at = excluded.window_started_at then rl.request_count + 1
      else 1
    end,
    updated_at = v_now
  returning request_count into v_count;

  allowed := v_count <= p_max_requests;
  remaining := greatest(p_max_requests - least(v_count, p_max_requests), 0);
  retry_after := case
    when allowed then 0
    else greatest(ceil(extract(epoch from (v_window_end - v_now)))::integer, 1)
  end;
  reset_at := v_window_end;

  return next;
end;
$$;

create table if not exists public.billing_webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  event_name text not null,
  payload_hash text not null,
  resource_type text,
  resource_id text,
  status text not null default 'processing'
    check (status in ('processing', 'processed', 'ignored', 'failed')),
  error_message text,
  received_at timestamptz not null default timezone('utc', now()),
  processed_at timestamptz
);

create unique index if not exists billing_webhook_events_provider_hash_key
  on public.billing_webhook_events (provider, payload_hash);

create index if not exists billing_webhook_events_received_at_idx
  on public.billing_webhook_events (received_at desc);

alter table public.billing_webhook_events enable row level security;

drop policy if exists billing_webhook_events_service_access on public.billing_webhook_events;
create policy billing_webhook_events_service_access
on public.billing_webhook_events
for all
to service_role
using (true)
with check (true);
