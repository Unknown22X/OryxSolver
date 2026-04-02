create table if not exists public.dismissed_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  notification_id uuid not null references public.notifications(id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  unique (user_id, notification_id)
);

create index if not exists dismissed_notifications_user_id_idx
  on public.dismissed_notifications (user_id);

create index if not exists dismissed_notifications_notification_id_idx
  on public.dismissed_notifications (notification_id);

alter table public.dismissed_notifications enable row level security;

drop policy if exists "Users can view their dismissed notifications" on public.dismissed_notifications;
create policy "Users can view their dismissed notifications"
on public.dismissed_notifications
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can insert their dismissed notifications" on public.dismissed_notifications;
create policy "Users can insert their dismissed notifications"
on public.dismissed_notifications
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Users can delete their dismissed notifications" on public.dismissed_notifications;
create policy "Users can delete their dismissed notifications"
on public.dismissed_notifications
for delete
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Admins can manage dismissed notifications" on public.dismissed_notifications;
create policy "Admins can manage dismissed notifications"
on public.dismissed_notifications
for all
to authenticated
using (exists (
  select 1
  from public.profiles
  where profiles.auth_user_id = auth.uid()
    and profiles.role = 'admin'
))
with check (exists (
  select 1
  from public.profiles
  where profiles.auth_user_id = auth.uid()
    and profiles.role = 'admin'
));
