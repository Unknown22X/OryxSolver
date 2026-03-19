create table if not exists public.credit_wallets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  granted_credits integer not null default 0 check (granted_credits >= 0),
  used_credits integer not null default 0 check (used_credits >= 0),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint credit_wallets_used_not_above_granted check (used_credits <= granted_credits)
);

create table if not exists public.credit_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  delta integer not null,
  balance_after integer not null check (balance_after >= 0),
  reason text not null,
  source text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists credit_ledger_user_id_created_at_idx
  on public.credit_ledger (user_id, created_at desc);

alter table public.credit_wallets enable row level security;
alter table public.credit_ledger enable row level security;

drop policy if exists credit_wallets_select_own on public.credit_wallets;
create policy credit_wallets_select_own
on public.credit_wallets
for select
to authenticated
using (user_id = (select auth.uid()));

drop policy if exists credit_ledger_select_own on public.credit_ledger;
create policy credit_ledger_select_own
on public.credit_ledger
for select
to authenticated
using (user_id = (select auth.uid()));

insert into public.credit_wallets (user_id, granted_credits, used_credits, created_at, updated_at)
select
  p.auth_user_id::uuid,
  greatest(coalesce(p.all_credits, 0), 0),
  greatest(least(coalesce(p.used_credits, 0), greatest(coalesce(p.all_credits, 0), 0)), 0),
  coalesce(p.created_at, timezone('utc', now())),
  coalesce(p.updated_at, timezone('utc', now()))
from public.profiles p
where p.auth_user_id is not null
on conflict (user_id) do update
set
  granted_credits = excluded.granted_credits,
  used_credits = excluded.used_credits,
  updated_at = timezone('utc', now());

insert into public.credit_ledger (user_id, delta, balance_after, reason, source, metadata, created_at)
select
  w.user_id,
  w.granted_credits,
  greatest(w.granted_credits, 0),
  'backfill_grant',
  'migration',
  jsonb_build_object('migration', '202603180001_entitlements_foundation'),
  timezone('utc', now())
from public.credit_wallets w
where w.granted_credits > 0
  and not exists (
    select 1
    from public.credit_ledger l
    where l.user_id = w.user_id
      and l.reason = 'backfill_grant'
      and l.source = 'migration'
  );

insert into public.credit_ledger (user_id, delta, balance_after, reason, source, metadata, created_at)
select
  w.user_id,
  -w.used_credits,
  greatest(w.granted_credits - w.used_credits, 0),
  'backfill_consume',
  'migration',
  jsonb_build_object('migration', '202603180001_entitlements_foundation'),
  timezone('utc', now())
from public.credit_wallets w
where w.used_credits > 0
  and not exists (
    select 1
    from public.credit_ledger l
    where l.user_id = w.user_id
      and l.reason = 'backfill_consume'
      and l.source = 'migration'
  );

create or replace function public.grant_paygo_credits(
  p_user_id uuid,
  p_amount integer,
  p_reason text default 'purchase',
  p_source text default 'system',
  p_metadata jsonb default '{}'::jsonb
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_granted integer;
  v_used integer;
  v_balance integer;
begin
  if p_amount is null or p_amount <= 0 then
    raise exception 'p_amount must be greater than zero';
  end if;

  insert into public.credit_wallets (user_id, granted_credits, used_credits)
  values (p_user_id, p_amount, 0)
  on conflict (user_id) do update
  set
    granted_credits = public.credit_wallets.granted_credits + excluded.granted_credits,
    updated_at = timezone('utc', now())
  returning granted_credits, used_credits
  into v_granted, v_used;

  v_balance := greatest(v_granted - v_used, 0);

  insert into public.credit_ledger (user_id, delta, balance_after, reason, source, metadata)
  values (p_user_id, p_amount, v_balance, p_reason, p_source, coalesce(p_metadata, '{}'::jsonb));

  return v_balance;
end;
$$;

create or replace function public.consume_paygo_credit(
  p_user_id uuid,
  p_amount integer default 1,
  p_reason text default 'solve',
  p_source text default 'system',
  p_metadata jsonb default '{}'::jsonb
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_granted integer;
  v_used integer;
  v_balance integer;
begin
  if p_amount is null or p_amount <= 0 then
    raise exception 'p_amount must be greater than zero';
  end if;

  update public.credit_wallets
  set
    used_credits = used_credits + p_amount,
    updated_at = timezone('utc', now())
  where user_id = p_user_id
    and (granted_credits - used_credits) >= p_amount
  returning granted_credits, used_credits
  into v_granted, v_used;

  if not found then
    raise exception 'INSUFFICIENT_PAYGO_CREDITS';
  end if;

  v_balance := greatest(v_granted - v_used, 0);

  insert into public.credit_ledger (user_id, delta, balance_after, reason, source, metadata)
  values (p_user_id, -p_amount, v_balance, p_reason, p_source, coalesce(p_metadata, '{}'::jsonb));

  return v_balance;
end;
$$;

alter table public.profiles
  alter column auth_user_id type uuid
  using nullif(auth_user_id::text, '')::uuid;

alter table public.profiles
  alter column auth_user_id set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_auth_user_id_fkey'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_auth_user_id_fkey
      foreign key (auth_user_id)
      references auth.users(id)
      on delete cascade;
  end if;
end;
$$;

drop policy if exists profiles_insert_own on public.profiles;
create policy profiles_insert_own
on public.profiles
for insert
to authenticated
with check (auth_user_id = (select auth.uid()));

drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own
on public.profiles
for select
to authenticated
using (auth_user_id = (select auth.uid()));

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own
on public.profiles
for update
to authenticated
using (auth_user_id = (select auth.uid()))
with check (auth_user_id = (select auth.uid()));

drop policy if exists profiles_update_own_safe on public.profiles;

drop policy if exists subscriptions_select_own on public.subscriptions;
create policy subscriptions_select_own
on public.subscriptions
for select
to authenticated
using (user_id = (select auth.uid()));

drop policy if exists app_config_admin_insert on public.app_config;
create policy app_config_admin_insert
on public.app_config
for insert
to authenticated
with check ((select public.is_admin_user(auth.uid())));

drop policy if exists app_config_admin_update on public.app_config;
create policy app_config_admin_update
on public.app_config
for update
to authenticated
using ((select public.is_admin_user(auth.uid())))
with check ((select public.is_admin_user(auth.uid())));

drop policy if exists app_config_admin_delete on public.app_config;
create policy app_config_admin_delete
on public.app_config
for delete
to authenticated
using ((select public.is_admin_user(auth.uid())));

drop policy if exists history_entries_select_own on public.history_entries;
create policy history_entries_select_own
on public.history_entries
for select
to authenticated
using (user_id = ((select auth.uid())::text));

drop policy if exists history_entries_insert_own on public.history_entries;
create policy history_entries_insert_own
on public.history_entries
for insert
to authenticated
with check (user_id = ((select auth.uid())::text));

drop policy if exists history_entries_update_own on public.history_entries;
create policy history_entries_update_own
on public.history_entries
for update
to authenticated
using (user_id = ((select auth.uid())::text))
with check (user_id = ((select auth.uid())::text));

drop policy if exists history_entries_delete_own on public.history_entries;
create policy history_entries_delete_own
on public.history_entries
for delete
to authenticated
using (user_id = ((select auth.uid())::text));

drop policy if exists feedback_insert_own on public.feedback;
create policy feedback_insert_own
on public.feedback
for insert
to authenticated
with check (user_id = (select auth.uid()));

drop policy if exists feedback_select_own on public.feedback;
create policy feedback_select_own
on public.feedback
for select
to authenticated
using (user_id = (select auth.uid()));

drop policy if exists usage_events_select_own on public.usage_events;
create policy usage_events_select_own
on public.usage_events
for select
to authenticated
using (user_id = (select auth.uid()));

drop policy if exists analytics_events_insert_authenticated on public.analytics_events;
drop policy if exists "Allow authenticated insert" on public.analytics_events;
create policy analytics_events_insert_authenticated
on public.analytics_events
for insert
to authenticated
with check (user_id is null or user_id = (select auth.uid()));

drop policy if exists solve_runs_select_own on public.solve_runs;
create policy solve_runs_select_own
on public.solve_runs
for select
to authenticated
using (auth_user_id = ((select auth.uid())::text));

drop policy if exists solve_runs_insert_own on public.solve_runs;
create policy solve_runs_insert_own
on public.solve_runs
for insert
to authenticated
with check (auth_user_id = ((select auth.uid())::text));

create index if not exists analytics_events_user_id_idx
  on public.analytics_events (user_id);

create index if not exists app_config_updated_by_idx
  on public.app_config (updated_by);

create index if not exists feedback_user_id_idx
  on public.feedback (user_id);

comment on table public.profiles is 'Identity, role, and user preferences. Billing and credits live outside profiles.';
comment on table public.credit_wallets is 'Current pay-as-you-go credit balances per user.';
comment on table public.credit_ledger is 'Immutable audit log of pay-as-you-go credit changes.';
