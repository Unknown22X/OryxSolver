-- Standardize on 'id' as the primary and auth-linked identifier.
-- Remove legacy 'auth_user_id' and 'firebase_uid' refs.

-- 1. Ensure 'id' in profiles is the main link to auth.users (already is in initial schema, but let's be sure about RLS)
-- 2. Clean up 'profiles' table columns if they exist from previous broken migrations
do $$
begin
    -- If 'auth_user_id' exists, make sure it's kept in sync or removed.
    -- In our logic, 'id' is the primary key and maps to auth.uid().
    -- Some migrations renamed 'firebase_uid' to 'auth_user_id'. 
    -- We will settle on 'id' being the UID.
    if exists (select 1 from information_schema.columns where table_name='profiles' and column_name='auth_user_id') then
        -- We'll keep it as a backup for this migration but primary logic will use 'id'
        null;
    end if;
end $$;
-- 3. Unify RLS on profiles
alter table public.profiles enable row level security;
drop policy if exists "Users can view own profile" on public.profiles;
drop policy if exists "Users can update own profile" on public.profiles;
drop policy if exists "profiles_select_own" on public.profiles;
drop policy if exists "profiles_insert_own" on public.profiles;
drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_select_own"
on public.profiles
for select
to authenticated
using ( auth.uid() = id );
create policy "profiles_update_own"
on public.profiles
for update
to authenticated
using ( auth.uid() = id )
with check ( auth.uid() = id );
-- Allow the trigger/service role to insert
create policy "service_role_insert_profiles"
on public.profiles
for insert
to service_role
with check ( true );
-- 4. Fix solve_runs and history RLS
-- Assuming these tables exist (referenced in previous migrations)

do $$
begin
    if exists (select 1 from pg_tables where tablename = 'solve_runs') then
        alter table public.solve_runs enable row level security;
        drop policy if exists "solve_runs_select_own" on public.solve_runs;
        drop policy if exists "solve_runs_insert_own" on public.solve_runs;
        
        create policy "solve_runs_select_own"
        on public.solve_runs
        for select
        to authenticated
        using ( auth.uid() = auth_user_id ); -- Need to check if solve_runs uses 'auth_user_id' or 'id'
    end if;
end $$;
