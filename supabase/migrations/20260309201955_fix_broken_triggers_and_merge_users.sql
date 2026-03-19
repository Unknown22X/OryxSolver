-- Remove legacy trigger/function drift without mutating environment-specific rows.
-- The original migration embedded hard-coded user IDs, which is unsafe for fresh
-- environments and CI databases.

drop trigger if exists trg_guard_profiles_update on public.profiles;
drop function if exists guard_profiles_update();

alter table if exists public.profiles enable row level security;

drop policy if exists "service_role_insert_profiles" on public.profiles;
create policy "service_role_insert_profiles"
on public.profiles
for insert
to service_role
with check (true);
