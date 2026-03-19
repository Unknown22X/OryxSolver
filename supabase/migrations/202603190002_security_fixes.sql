-- Security hardening pass.
-- This migration is intentionally idempotent and avoids invalid RLS constructs.

alter table if exists public.profiles enable row level security;

drop policy if exists "profiles_insert" on public.profiles;
create policy "profiles_insert"
on public.profiles
for insert
to authenticated
with check (auth.uid()::text = auth_user_id);

drop policy if exists "profiles_update" on public.profiles;
create policy "profiles_update"
on public.profiles
for update
to authenticated
using (auth.uid()::text = auth_user_id)
with check (auth.uid()::text = auth_user_id);

drop policy if exists "profiles_select" on public.profiles;
create policy "profiles_select"
on public.profiles
for select
to authenticated
using (auth.uid()::text = auth_user_id);

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profiles'
      and column_name in (
        'subscription_tier',
        'subscription_status',
        'used_credits',
        'all_credits',
        'monthly_images_used',
        'monthly_images_period',
        'step_questions_used',
        'role',
        'paddle_customer_id',
        'email_verified',
        'auth_user_id',
        'email'
      )
  ) then
    revoke update (
      subscription_tier,
      subscription_status,
      used_credits,
      all_credits,
      monthly_images_used,
      monthly_images_period,
      step_questions_used,
      role,
      paddle_customer_id,
      email_verified,
      auth_user_id,
      email
    ) on public.profiles from authenticated;
  end if;
exception
  when undefined_column then
    null;
end
$$;

do $$
begin
  grant update (display_name, photo_url, last_seen_at) on public.profiles to authenticated;
exception
  when undefined_column then
    null;
end
$$;

alter table if exists public.questions_cache enable row level security;
drop policy if exists "questions_cache_service_access" on public.questions_cache;
create policy "questions_cache_service_access"
on public.questions_cache
for all
to service_role
using (true)
with check (true);

alter table if exists public.subscriptions enable row level security;
drop policy if exists "subscriptions_select" on public.subscriptions;
create policy "subscriptions_select"
on public.subscriptions
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "subscriptions_service_insert" on public.subscriptions;
create policy "subscriptions_service_insert"
on public.subscriptions
for insert
to service_role
with check (true);

drop policy if exists "subscriptions_service_update" on public.subscriptions;
create policy "subscriptions_service_update"
on public.subscriptions
for update
to service_role
using (true)
with check (true);

alter table if exists public.history_entries enable row level security;
drop policy if exists "history_select" on public.history_entries;
create policy "history_select"
on public.history_entries
for select
to authenticated
using (auth.uid()::text = user_id);

drop policy if exists "history_insert" on public.history_entries;
create policy "history_insert"
on public.history_entries
for insert
to authenticated
with check (auth.uid()::text = user_id);

alter table if exists public.solve_runs enable row level security;
drop policy if exists "solve_runs_service_read" on public.solve_runs;
create policy "solve_runs_service_read"
on public.solve_runs
for select
to service_role
using (true);

drop policy if exists "solve_runs_service_insert" on public.solve_runs;
create policy "solve_runs_service_insert"
on public.solve_runs
for insert
to service_role
with check (true);

alter table if exists public.usage_events enable row level security;
drop policy if exists "usage_events_service_read" on public.usage_events;
create policy "usage_events_service_read"
on public.usage_events
for select
to service_role
using (true);

drop policy if exists "usage_events_service_insert" on public.usage_events;
create policy "usage_events_service_insert"
on public.usage_events
for insert
to service_role
with check (true);

alter table if exists public.analytics_events enable row level security;
drop policy if exists "analytics_events_insert" on public.analytics_events;
create policy "analytics_events_insert"
on public.analytics_events
for insert
to authenticated
with check (auth.uid()::text = user_id or user_id is null);

drop policy if exists "analytics_events_service_read" on public.analytics_events;
create policy "analytics_events_service_read"
on public.analytics_events
for select
to service_role
using (true);

alter table if exists public.feedback enable row level security;
drop policy if exists "feedback_select" on public.feedback;
create policy "feedback_select"
on public.feedback
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "feedback_insert" on public.feedback;
create policy "feedback_insert"
on public.feedback
for insert
to authenticated
with check (auth.uid() = user_id);
