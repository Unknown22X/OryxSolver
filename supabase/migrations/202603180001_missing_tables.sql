-- Migration: Add missing tables for usage tracking, feedback, and subscriptions

-- 1) Usage Events (Granular tracking of credit usage)
CREATE TABLE IF NOT EXISTS public.usage_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT now(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL, -- 'solve', 'image_vision', 'bulk_solve'
    credits_spent INTEGER DEFAULT 0,
    metadata JSONB DEFAULT '{}'::jsonb
);

ALTER TABLE public.usage_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "usage_events_select_own" ON public.usage_events
    FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE INDEX idx_usage_events_user_id ON public.usage_events(user_id);
CREATE INDEX idx_usage_events_created_at ON public.usage_events(created_at);

-- 2) Feedback (User ratings and comments)
CREATE TABLE IF NOT EXISTS public.feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT now(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    conversation_id UUID, -- Optional: link to history_entries
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    metadata JSONB DEFAULT '{}'::jsonb
);

ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "feedback_insert_own" ON public.feedback
    FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE POLICY "feedback_select_own" ON public.feedback
    FOR SELECT TO authenticated USING (user_id = auth.uid());

-- 3) Subscriptions (Linked to payment providers)
CREATE TABLE IF NOT EXISTS public.subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
    status TEXT NOT NULL, -- 'active', 'trialing', 'past_due', 'canceled', 'unpaid'
    tier TEXT DEFAULT 'free', -- 'free', 'pro'
    provider TEXT, -- 'lemon_squeezy', 'stripe'
    provider_subscription_id TEXT,
    provider_customer_id TEXT,
    current_period_end TIMESTAMPTZ,
    cancel_at_period_end BOOLEAN DEFAULT false
);

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "subscriptions_select_own" ON public.subscriptions
    FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE INDEX idx_subscriptions_user_id ON public.subscriptions(user_id);
CREATE INDEX idx_subscriptions_provider_id ON public.subscriptions(provider_subscription_id);
