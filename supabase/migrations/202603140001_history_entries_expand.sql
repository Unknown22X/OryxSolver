alter table if exists public.history_entries
  add column if not exists explanation text,
  add column if not exists conversation_id uuid,
  add column if not exists style_mode text,
  add column if not exists image_urls text[] not null default '{}'::text[],
  add column if not exists is_bulk boolean not null default false,
  add column if not exists steps text[] not null default '{}'::text[];

create index if not exists history_entries_conversation_id_idx
  on public.history_entries (conversation_id);
