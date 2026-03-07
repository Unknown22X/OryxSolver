-- Firebase/third-party JWTs may not carry role=authenticated claim.
-- Keep ownership checks via auth.jwt()->>'sub', but allow policy target role = public.

alter table if exists public.profiles enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
on public.profiles
for select
to public
using (firebase_uid = auth.jwt()->>'sub');

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
on public.profiles
for insert
to public
with check (firebase_uid = auth.jwt()->>'sub');

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
on public.profiles
for update
to public
using (firebase_uid = auth.jwt()->>'sub')
with check (firebase_uid = auth.jwt()->>'sub');

alter table if exists public.history_entries enable row level security;

drop policy if exists "history_entries_select_own" on public.history_entries;
create policy "history_entries_select_own"
on public.history_entries
for select
to public
using (user_id = auth.jwt()->>'sub');

drop policy if exists "history_entries_insert_own" on public.history_entries;
create policy "history_entries_insert_own"
on public.history_entries
for insert
to public
with check (user_id = auth.jwt()->>'sub');

