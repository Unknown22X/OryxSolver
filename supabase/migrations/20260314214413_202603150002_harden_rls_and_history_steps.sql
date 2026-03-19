-- Harden RLS/privileges and align history schema with Edge Function writes.

-- 1) history_entries: ensure steps exist and array fields are non-null.
alter table if exists public.history_entries
  add column if not exists steps text[] not null default '{}'::text[];

update public.history_entries
  set steps = '{}'::text[]
where steps is null;

update public.history_entries
  set image_urls = '{}'::text[]
where image_urls is null;

alter table if exists public.history_entries
  alter column image_urls set not null;

update public.history_entries
  set is_bulk = false
where is_bulk is null;

alter table if exists public.history_entries
  alter column is_bulk set not null;

-- 2) Remove profile delete + insert policies for authenticated users.
drop policy if exists "profiles_delete_own" on public.profiles;
drop policy if exists "profiles_insert_own" on public.profiles;

-- 3) Tighten grants: default revoke anon/authenticated, then grant minimal.
revoke all on table public.profiles from anon, authenticated;
revoke all on table public.history_entries from anon, authenticated;
revoke all on table public.solve_runs from anon, authenticated;

-- Profiles: authenticated can select and update limited columns only.
grant select on table public.profiles to authenticated;
grant update (display_name, photo_url, last_seen_at) on table public.profiles to authenticated;

-- History entries: authenticated can read/write their own rows (RLS enforced).
grant select, insert, update, delete on table public.history_entries to authenticated;

-- Solve runs: authenticated can insert/select only (RLS enforced).
grant select, insert on table public.solve_runs to authenticated;
;
