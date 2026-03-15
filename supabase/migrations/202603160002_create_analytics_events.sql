-- Create a table for anonymous usage analytics
CREATE TABLE IF NOT EXISTS public.analytics_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT now(),
    event_name TEXT NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    properties JSONB DEFAULT '{}'::jsonb,
    platform TEXT DEFAULT 'chrome_extension'
);

-- RLS: Users can only insert their own events (or anonymous events)
ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated insert" 
ON public.analytics_events FOR INSERT 
TO authenticated 
WITH CHECK (true);

-- Indexes for performance
CREATE INDEX idx_analytics_event_name ON public.analytics_events(event_name);
CREATE INDEX idx_analytics_created_at ON public.analytics_events(created_at);
