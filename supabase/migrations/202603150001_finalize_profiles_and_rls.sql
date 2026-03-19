-- Finalize auth linkage, profile columns, and RLS policies.
-- Aligns DB schema with Edge Functions expectations.

-- 1) Profiles: add missing columns used by Edge Functions.
alter table if exists public.profiles
  add column if not exists auth_user_id text,
  add column if not exists email_verified boolean not null default false,
  add column if not exists display_name text,
  add column if not exists photo_url text,
  add column if not exists all_credits integer not null default 50,
  add column if not exists used_credits integer not null default 0,
  add column if not exists last_seen_at timestamptz;
-- 2) Backfill auth_user_id from legacy columns where possible.
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profiles'
      and column_name = 'firebase_uid'
  ) then
    update public.profiles
      set auth_user_id = coalesce(auth_user_id, firebase_uid)
    where auth_user_id is null;
  end if;
end $$;
update public.profiles
  set auth_user_id = coalesce(auth_user_id, id::text)
where auth_user_id is null;
-- 3) Enforce constraints if safe.
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profiles'
      and column_name = 'auth_user_id'
  ) then
    if not exists (select 1 from public.profiles where auth_user_id is null) then
      alter table public.profiles
        alter column auth_user_id set not null;
    end if;
  end if;
end $$;
create unique index if not exists profiles_auth_user_id_key
  on public.profiles (auth_user_id);
-- Role check constraint (if missing).
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_role_check'
  ) then
    alter table public.profiles
      add constraint profiles_role_check
      check (role in ('pending', 'authenticated', 'admin'));
  end if;
end $$;
-- 4) Solve runs: ensure auth_user_id column exists and RLS uses it.
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'solve_runs'
      and column_name = 'firebase_uid'
  ) and not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'solve_runs'
      and column_name = 'auth_user_id'
  ) then
    alter table public.solve_runs rename column firebase_uid to auth_user_id;
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'solve_runs'
      and column_name = 'auth_user_id'
  ) then
    alter table public.solve_runs
      add column auth_user_id text;
  end if;
end $$;
create index if not exists solve_runs_auth_user_id_created_at_idx
  on public.solve_runs (auth_user_id, created_at desc);
-- 5) Standardize RLS policies on auth_user_id / user_id.
alter table if exists public.profiles enable row level security;
drop policy if exists "Users can view own profile" on public.profiles;
drop policy if exists "Users can update own profile" on public.profiles;
drop policy if exists "profiles_select_own" on public.profiles;
drop policy if exists "profiles_insert_own" on public.profiles;
drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_select_own"
on public.profiles
for select
to authenticated
using (auth_user_id::text = auth.jwt()->>'sub');
create policy "profiles_insert_own"
on public.profiles
for insert
to authenticated
with check (auth_user_id::text = auth.jwt()->>'sub');
create policy "profiles_update_own"
on public.profiles
for update
to authenticated
using (auth_user_id::text = auth.jwt()->>'sub')
with check (auth_user_id::text = auth.jwt()->>'sub');
alter table if exists public.solve_runs enable row level security;
drop policy if exists "solve_runs_select_own" on public.solve_runs;
drop policy if exists "solve_runs_insert_own" on public.solve_runs;
create policy "solve_runs_select_own"
on public.solve_runs
for select
to authenticated
using (auth_user_id::text = auth.jwt()->>'sub');
create policy "solve_runs_insert_own"
on public.solve_runs
for insert
to authenticated
with check (auth_user_id::text = auth.jwt()->>'sub');
alter table if exists public.history_entries enable row level security;
drop policy if exists "history_entries_select_own" on public.history_entries;
drop policy if exists "history_entries_insert_own" on public.history_entries;
drop policy if exists "history_entries_update_own" on public.history_entries;
drop policy if exists "history_entries_delete_own" on public.history_entries;
create policy "history_entries_select_own"
on public.history_entries
for select
to authenticated
using (user_id::text = auth.jwt()->>'sub');
create policy "history_entries_insert_own"
on public.history_entries
for insert
to authenticated
with check (user_id::text = auth.jwt()->>'sub');
create policy "history_entries_update_own"
on public.history_entries
for update
to authenticated
using (user_id::text = auth.jwt()->>'sub')
with check (user_id::text = auth.jwt()->>'sub');
create policy "history_entries_delete_own"
on public.history_entries
for delete
to authenticated
using (user_id::text = auth.jwt()->>'sub');
