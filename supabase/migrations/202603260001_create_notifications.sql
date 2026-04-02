-- Create notifications table
CREATE TABLE public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE, -- NULL means global/everyone
    type TEXT NOT NULL DEFAULT 'info' CHECK (type IN ('info', 'warning', 'success', 'promo')),
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    link TEXT,
    is_read BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indices for performance
CREATE INDEX idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX idx_notifications_created_at ON public.notifications(created_at DESC);

-- Enable RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Policies
-- 1. Users can view notifications where user_id is NULL or matches their ID
CREATE POLICY "Users can view their notifications"
    ON public.notifications FOR SELECT
    USING (
        auth.uid() = user_id OR
        user_id IS NULL
    );

-- 2. Users can mark their own notifications as read
CREATE POLICY "Users can update their own unread notifications"
    ON public.notifications FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- 3. Admins can do anything
CREATE POLICY "Admins can manage all notifications"
    ON public.notifications FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.auth_user_id = auth.uid()
            AND profiles.role = 'admin'
        )
    );

-- Comments
COMMENT ON TABLE public.notifications IS 'Persistent in-app notifications for users. NULL user_id indicates a global broadcast.';
