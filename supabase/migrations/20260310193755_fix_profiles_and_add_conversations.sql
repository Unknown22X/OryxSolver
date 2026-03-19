-- Align conversations/history policies without widening access to anon/public roles.

alter table public.profiles alter column id set default gen_random_uuid();

alter table public.history_entries add column if not exists conversation_id uuid default gen_random_uuid();
alter table public.history_entries add column if not exists style_mode text;

drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own
on public.profiles
for select
to authenticated
using (auth_user_id = (select auth.uid())::text);

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own
on public.profiles
for update
to authenticated
using (auth_user_id = (select auth.uid())::text)
with check (auth_user_id = (select auth.uid())::text);

drop policy if exists history_entries_select_own on public.history_entries;
create policy history_entries_select_own
on public.history_entries
for select
to authenticated
using (user_id = (select auth.uid())::text);

drop policy if exists history_entries_insert_own on public.history_entries;
create policy history_entries_insert_own
on public.history_entries
for insert
to authenticated
with check (user_id = (select auth.uid())::text);
