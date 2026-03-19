insert into public.app_config (key, value, is_public)
values (
  'support_contact',
  jsonb_build_object('email', 'support@oryxsolver.com'),
  true
)
on conflict (key) do update
set
  value = excluded.value,
  is_public = excluded.is_public,
  updated_at = timezone('utc', now());

insert into public.app_config (key, value, is_public)
values (
  'product_features',
  jsonb_build_object(
    'items',
    jsonb_build_array(
      jsonb_build_object(
        'id', 'capture',
        'title', 'Screenshot solving',
        'description', 'Placeholder: highlight a question on the page and send it to OryxSolver without leaving the tab.',
        'enabled', true
      ),
      jsonb_build_object(
        'id', 'explanations',
        'title', 'Clean worked solutions',
        'description', 'Placeholder: answers can show a final answer, ordered steps, and a short explanation that adds context.',
        'enabled', true
      ),
      jsonb_build_object(
        'id', 'modes',
        'title', 'Solve modes',
        'description', 'Placeholder: users can choose the response style before starting a thread.',
        'enabled', true
      ),
      jsonb_build_object(
        'id', 'threaded_followups',
        'title', 'Threaded follow-ups',
        'description', 'Placeholder: keep one main question and continue with follow-up questions inside the same conversation.',
        'enabled', true
      ),
      jsonb_build_object(
        'id', 'history_sync',
        'title', 'Shared account data',
        'description', 'Placeholder: profile, history, and usage should stay in sync between the web app and extension.',
        'enabled', true
      )
    )
  ),
  true
)
on conflict (key) do update
set
  value = excluded.value,
  is_public = excluded.is_public,
  updated_at = timezone('utc', now());

update public.app_config
set value = jsonb_set(
  value,
  '{sections,6,body}',
  to_jsonb('For legal requests, contact support@oryxsolver.com.'::text),
  true
)
where key = 'terms_content'
  and value #>> '{sections,6,heading}' = '7. Contact';
