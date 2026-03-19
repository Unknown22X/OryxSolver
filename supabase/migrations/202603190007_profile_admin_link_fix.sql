-- Fix admin/profile linkage drift between legacy id-based rows and auth_user_id rows.
-- Ensures admin checks and profile RLS are consistent.

update public.profiles
set auth_user_id = id::text
where auth_user_id is null
  and id is not null;

alter table public.profiles enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
drop policy if exists "profiles_insert_own" on public.profiles;
drop policy if exists "profiles_update_own" on public.profiles;

create policy "profiles_select_own"
on public.profiles
for select
to authenticated
using (
  auth.uid()::text = auth_user_id
  or auth.uid() = id
);

create policy "profiles_insert_own"
on public.profiles
for insert
to authenticated
with check (
  auth.uid()::text = auth_user_id
  or auth.uid() = id
);

create policy "profiles_update_own"
on public.profiles
for update
to authenticated
using (
  auth.uid()::text = auth_user_id
  or auth.uid() = id
)
with check (
  auth.uid()::text = auth_user_id
  or auth.uid() = id
);
