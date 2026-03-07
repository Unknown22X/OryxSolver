-- Firebase third-party JWT RLS policies for profiles
-- Assumes profiles.firebase_uid stores Firebase UID (JWT sub)

alter table if exists public.profiles enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
on public.profiles
for select
to authenticated
using (firebase_uid = auth.jwt()->>'sub');

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
on public.profiles
for insert
to authenticated
with check (firebase_uid = auth.jwt()->>'sub');

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
on public.profiles
for update
to authenticated
using (firebase_uid = auth.jwt()->>'sub')
with check (firebase_uid = auth.jwt()->>'sub');

