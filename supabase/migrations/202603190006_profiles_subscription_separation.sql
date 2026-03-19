-- Enforce clean ownership boundary:
-- - Subscriptions live in public.subscriptions.
-- - Profiles no longer store subscription tier/status/provider customer ids.

do $$
declare
  has_auth_user_id boolean;
  has_subscription_tier boolean;
  has_subscription_status boolean;
  has_paddle_customer_id boolean;
  has_lemon_customer_id boolean;
begin
  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'auth_user_id'
  ) into has_auth_user_id;
  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'subscription_tier'
  ) into has_subscription_tier;
  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'subscription_status'
  ) into has_subscription_status;
  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'paddle_customer_id'
  ) into has_paddle_customer_id;
  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'lemon_customer_id'
  ) into has_lemon_customer_id;

  -- Final one-way sync from any legacy profile columns into subscriptions.
  if has_auth_user_id and (has_subscription_tier or has_subscription_status or has_paddle_customer_id or has_lemon_customer_id) then
    insert into public.subscriptions (
      user_id,
      status,
      tier,
      provider,
      provider_customer_id,
      created_at,
      updated_at
    )
    select
      case
        when p.auth_user_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
          then p.auth_user_id::uuid
        else p.id
      end as user_id,
      case
        when has_subscription_status then coalesce(p.subscription_status, 'inactive')
        else 'inactive'
      end as status,
      case
        when has_subscription_tier then coalesce(p.subscription_tier, 'free')
        else 'free'
      end as tier,
      case
        when has_lemon_customer_id and p.lemon_customer_id is not null then 'lemon_squeezy'
        when has_paddle_customer_id and p.paddle_customer_id is not null then 'paddle'
        else 'none'
      end as provider,
      case
        when has_lemon_customer_id and p.lemon_customer_id is not null then p.lemon_customer_id
        when has_paddle_customer_id and p.paddle_customer_id is not null then p.paddle_customer_id
        else null
      end as provider_customer_id,
      coalesce(p.created_at, now()),
      coalesce(p.updated_at, now())
    from public.profiles p
    where p.auth_user_id is not null
    on conflict (user_id) do update
      set
        status = excluded.status,
        tier = excluded.tier,
        provider = case when public.subscriptions.provider = 'none' then excluded.provider else public.subscriptions.provider end,
        provider_customer_id = coalesce(public.subscriptions.provider_customer_id, excluded.provider_customer_id),
        updated_at = now();
  end if;
end $$;

alter table public.profiles enable row level security;
drop policy if exists "profiles_select_own" on public.profiles;
drop policy if exists "profiles_insert_own" on public.profiles;
drop policy if exists "profiles_update_own" on public.profiles;
drop policy if exists "profiles_select" on public.profiles;
drop policy if exists "profiles_insert" on public.profiles;
drop policy if exists "profiles_update" on public.profiles;

create policy "profiles_select_own"
on public.profiles
for select
to authenticated
using (auth.uid()::text = auth_user_id);

create policy "profiles_insert_own"
on public.profiles
for insert
to authenticated
with check (auth.uid()::text = auth_user_id);

create policy "profiles_update_own"
on public.profiles
for update
to authenticated
using (auth.uid()::text = auth_user_id)
with check (auth.uid()::text = auth_user_id);

-- Drop legacy subscription columns from profiles so writes cannot drift.
alter table public.profiles drop column if exists subscription_tier;
alter table public.profiles drop column if exists subscription_status;
alter table public.profiles drop column if exists paddle_customer_id;
alter table public.profiles drop column if exists lemon_customer_id;

-- Keep this table strictly for account/profile + paygo counters.
comment on table public.profiles is
  'Account profile and non-subscription usage fields. Subscription source-of-truth is public.subscriptions.';
