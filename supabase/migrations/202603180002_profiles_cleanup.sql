create or replace function public.touch_app_config_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

alter table public.profiles
  drop column if exists all_credits,
  drop column if exists used_credits,
  drop column if exists monthly_images_used,
  drop column if exists monthly_images_period,
  drop column if exists step_questions_used;

comment on table public.profiles is 'Identity, role, and user preferences only. Subscription state is in public.subscriptions and paygo credits are in public.credit_wallets.';
