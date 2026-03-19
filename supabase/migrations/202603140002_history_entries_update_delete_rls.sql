alter table if exists public.history_entries enable row level security;
drop policy if exists "history_entries_update_own" on public.history_entries;
create policy "history_entries_update_own"
on public.history_entries
for update
to public
using (user_id = auth.jwt()->>'sub')
with check (user_id = auth.jwt()->>'sub');
drop policy if exists "history_entries_delete_own" on public.history_entries;
create policy "history_entries_delete_own"
on public.history_entries
for delete
to public
using (user_id = auth.jwt()->>'sub');
