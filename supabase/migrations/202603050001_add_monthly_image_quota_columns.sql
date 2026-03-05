alter table public.profiles
  add column if not exists monthly_images_used integer not null default 0,
  add column if not exists monthly_images_period date not null default (date_trunc('month', now())::date);
