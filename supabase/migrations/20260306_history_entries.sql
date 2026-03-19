create table if not exists public.history_entries (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  question text not null,
  answer text not null,
  source text not null default 'extension',
  created_at timestamptz not null default now()
);
alter table public.history_entries enable row level security;
drop policy if exists "history_entries_select_own" on public.history_entries;
create policy "history_entries_select_own"
on public.history_entries
for select
to authenticated
using (user_id = auth.jwt()->>'sub');
drop policy if exists "history_entries_insert_own" on public.history_entries;
create policy "history_entries_insert_own"
on public.history_entries
for insert
to authenticated
with check (user_id = auth.jwt()->>'sub');
