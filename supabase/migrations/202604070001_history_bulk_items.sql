alter table if exists public.history_entries
  add column if not exists bulk_items jsonb not null default '[]'::jsonb;

update public.history_entries
  set bulk_items = '[]'::jsonb
where bulk_items is null;
