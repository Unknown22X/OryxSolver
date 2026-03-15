-- Speed up history list queries by user with newest-first sort.
create index if not exists idx_history_entries_user_id_created_at
  on public.history_entries (user_id, created_at desc);
