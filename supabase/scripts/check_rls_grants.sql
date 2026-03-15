-- CI guard: ensure RLS + grants are locked down for core tables.
-- Run with: supabase db query --file supabase/scripts/check_rls_grants.sql

do $$
declare
  missing_count int;
begin
  -- RLS must be enabled.
  select count(*) into missing_count
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname in ('profiles', 'history_entries', 'solve_runs')
    and c.relrowsecurity = false;

  if missing_count > 0 then
    raise exception 'RLS is not enabled on one or more core tables';
  end if;

  -- No anon grants on core tables.
  select count(*) into missing_count
  from information_schema.role_table_grants
  where table_schema = 'public'
    and table_name in ('profiles', 'history_entries', 'solve_runs')
    and grantee = 'anon';

  if missing_count > 0 then
    raise exception 'anon grants detected on core tables';
  end if;

  -- Required authenticated policies.
  with required as (
    select * from (values
      ('profiles', 'SELECT', 'authenticated'),
      ('profiles', 'UPDATE', 'authenticated'),
      ('history_entries', 'SELECT', 'authenticated'),
      ('history_entries', 'INSERT', 'authenticated'),
      ('history_entries', 'UPDATE', 'authenticated'),
      ('history_entries', 'DELETE', 'authenticated'),
      ('solve_runs', 'SELECT', 'authenticated'),
      ('solve_runs', 'INSERT', 'authenticated')
    ) as t(tablename, cmd, role)
  )
  select count(*) into missing_count
  from required r
  where not exists (
    select 1
    from pg_policies p
    where p.schemaname = 'public'
      and p.tablename = r.tablename
      and p.cmd = r.cmd
      and p.roles @> array[r.role]
  );

  if missing_count > 0 then
    raise exception 'Missing one or more required RLS policies';
  end if;
end $$;
