-- Rename legacy identity uid column names to provider-agnostic names.
-- This keeps existing data and updates RLS to use auth_user_id.

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profiles'
      and column_name = 'firebase_uid'
  ) then
    alter table public.profiles rename column firebase_uid to auth_user_id;
  end if;
end $$;
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'solve_runs'
      and column_name = 'firebase_uid'
  ) then
    alter table public.solve_runs rename column firebase_uid to auth_user_id;
  end if;
end $$;
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
on public.profiles
for select
to authenticated
using (auth_user_id = auth.jwt()->>'sub');
drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
on public.profiles
for insert
to authenticated
with check (auth_user_id = auth.jwt()->>'sub');
drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
on public.profiles
for update
to authenticated
using (auth_user_id = auth.jwt()->>'sub')
with check (auth_user_id = auth.jwt()->>'sub');
drop policy if exists "solve_runs_select_own" on public.solve_runs;
create policy "solve_runs_select_own"
on public.solve_runs
for select
to public
using (auth_user_id = auth.jwt()->>'sub');
drop policy if exists "solve_runs_insert_own" on public.solve_runs;
create policy "solve_runs_insert_own"
on public.solve_runs
for insert
to public
with check (auth_user_id = auth.jwt()->>'sub');
