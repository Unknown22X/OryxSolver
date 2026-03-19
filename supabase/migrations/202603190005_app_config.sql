-- Admin-managed app configuration for legal docs and feature content.

create table if not exists public.app_config (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  value jsonb not null default '{}'::jsonb,
  is_public boolean not null default true,
  updated_at timestamptz not null default timezone('utc', now()),
  updated_by uuid references auth.users (id)
);

alter table public.app_config enable row level security;

create or replace function public.is_admin_user(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.auth_user_id = uid
      and p.role = 'admin'
  );
$$;

drop policy if exists "app_config_public_read" on public.app_config;
create policy "app_config_public_read"
on public.app_config
for select
using (is_public = true);

drop policy if exists "app_config_admin_insert" on public.app_config;
create policy "app_config_admin_insert"
on public.app_config
for insert
to authenticated
with check (public.is_admin_user(auth.uid()));

drop policy if exists "app_config_admin_update" on public.app_config;
create policy "app_config_admin_update"
on public.app_config
for update
to authenticated
using (public.is_admin_user(auth.uid()))
with check (public.is_admin_user(auth.uid()));

drop policy if exists "app_config_admin_delete" on public.app_config;
create policy "app_config_admin_delete"
on public.app_config
for delete
to authenticated
using (public.is_admin_user(auth.uid()));

create or replace function public.touch_app_config_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists app_config_touch_updated_at on public.app_config;
create trigger app_config_touch_updated_at
before update on public.app_config
for each row execute function public.touch_app_config_updated_at();

insert into public.app_config (key, value, is_public)
values
  (
    'legal_versions',
    jsonb_build_object(
      'terms_version', '2026-03-18',
      'privacy_version', '2026-03-18',
      'effective_date', '2026-03-18'
    ),
    true
  ),
  (
    'terms_content',
    jsonb_build_object(
      'title', 'Terms of Service',
      'intro', 'These Terms of Service govern your use of OryxSolver web and extension services.',
      'sections', jsonb_build_array(
        jsonb_build_object(
          'heading', '1. Eligibility and Account',
          'body', 'You must be at least 13 years old and legally able to enter this agreement. You are responsible for safeguarding your account credentials and all activity under your account.'
        ),
        jsonb_build_object(
          'heading', '2. Educational Use and Conduct',
          'body', 'OryxSolver is intended for learning support. You may not use the service to violate school policies, submit generated answers as your own work without review, or abuse the platform, APIs, or infrastructure.'
        ),
        jsonb_build_object(
          'heading', '3. Billing and Subscriptions',
          'body', 'Paid plans renew automatically unless canceled. Charges are processed by Lemon Squeezy and related processors. Refund eligibility follows the policy displayed at checkout and applicable consumer law.'
        ),
        jsonb_build_object(
          'heading', '4. AI Output Disclaimer',
          'body', 'AI-generated output may be incomplete or incorrect. You are responsible for validating results before relying on them for assignments, exams, or professional decisions.'
        ),
        jsonb_build_object(
          'heading', '5. Suspension and Termination',
          'body', 'We may suspend or terminate accounts for policy violations, security risk, or unlawful activity. You may stop using the service at any time.'
        ),
        jsonb_build_object(
          'heading', '6. Limitation of Liability',
          'body', 'To the fullest extent permitted by law, the service is provided "as is" and we are not liable for indirect or consequential damages resulting from use of the service.'
        ),
        jsonb_build_object(
          'heading', '7. Contact',
          'body', 'For legal requests, contact support@oryxsolver.com.'
        )
      )
    ),
    true
  ),
  (
    'privacy_content',
    jsonb_build_object(
      'title', 'Privacy Policy',
      'intro', 'This Privacy Policy explains what data we collect, how we use it, and your rights.',
      'sections', jsonb_build_array(
        jsonb_build_object(
          'heading', '1. Information We Collect',
          'body', 'We collect account details, submitted questions, optional images, usage telemetry, and billing status data needed to provide the service.'
        ),
        jsonb_build_object(
          'heading', '2. How We Use Information',
          'body', 'We use data to authenticate users, deliver AI responses, maintain usage limits, improve product quality, and provide support.'
        ),
        jsonb_build_object(
          'heading', '3. Billing and Processors',
          'body', 'Payments are handled by Lemon Squeezy and its processing partners. We do not store full payment card details on our systems.'
        ),
        jsonb_build_object(
          'heading', '4. Sharing and Disclosure',
          'body', 'We do not sell personal data. We share data only with service providers needed to operate the platform or when required by law.'
        ),
        jsonb_build_object(
          'heading', '5. Retention and Deletion',
          'body', 'We retain data as needed for service operation, security, legal compliance, and dispute resolution. You can request deletion of account data through support.'
        ),
        jsonb_build_object(
          'heading', '6. Your Rights',
          'body', 'Depending on your location, you may have rights to access, correct, export, or delete your data. Contact us to submit a request.'
        ),
        jsonb_build_object(
          'heading', '7. Contact',
          'body', 'For privacy requests, contact privacy@oryxsolver.com.'
        )
      )
    ),
    true
  ),
  (
    'product_features',
    jsonb_build_object(
      'items',
      jsonb_build_array(
        jsonb_build_object(
          'id', 'capture',
          'title', 'Capture from any tab',
          'description', 'Use the Chrome extension to capture questions directly from your current page.',
          'enabled', true
        ),
        jsonb_build_object(
          'id', 'explanations',
          'title', 'Step-by-step explanations',
          'description', 'Get structured solutions designed for understanding, not just final answers.',
          'enabled', true
        ),
        jsonb_build_object(
          'id', 'modes',
          'title', 'Multiple solve styles',
          'description', 'Switch answer style based on task: Standard, Exam, ELI5, Step-by-Step, and more.',
          'enabled', true
        ),
        jsonb_build_object(
          'id', 'history_sync',
          'title', 'Shared web and extension history',
          'description', 'Start in the extension and continue in the web dashboard with the same account data.',
          'enabled', true
        )
      )
    ),
    true
  ),
  (
    'support_contact',
    jsonb_build_object(
      'email', 'support@oryxsolver.com'
    ),
    true
  )
on conflict (key) do nothing;
