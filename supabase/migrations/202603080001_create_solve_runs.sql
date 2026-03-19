create table if not exists public.solve_runs (
  id uuid primary key default gen_random_uuid(),
  firebase_uid text not null,
  mode text not null,
  style_mode text not null,
  model text,
  latency_ms integer not null,
  status text not null,
  error_code text,
  used_fallback boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists idx_solve_runs_uid_created_at
  on public.solve_runs (firebase_uid, created_at desc);
alter table public.solve_runs enable row level security;
drop policy if exists "solve_runs_select_own" on public.solve_runs;
create policy "solve_runs_select_own"
on public.solve_runs
for select
to public
using (firebase_uid = auth.jwt()->>'sub');
drop policy if exists "solve_runs_insert_own" on public.solve_runs;
create policy "solve_runs_insert_own"
on public.solve_runs
for insert
to public
with check (firebase_uid = auth.jwt()->>'sub');
