-- Tighten analytics event writes so authenticated clients can only attribute
-- events to their own account. Service-role/admin reads remain unaffected.

DROP POLICY IF EXISTS "Allow authenticated insert" ON public.analytics_events;

CREATE POLICY "analytics_events_insert_own_user"
ON public.analytics_events
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);
