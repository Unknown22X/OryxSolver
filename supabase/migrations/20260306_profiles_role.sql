alter table if exists public.profiles
  add column if not exists role text not null default 'pending';

-- Optional safety check
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_role_check'
  ) then
    alter table public.profiles
      add constraint profiles_role_check
      check (role in ('pending', 'authenticated', 'admin'));
  end if;
end$$;

