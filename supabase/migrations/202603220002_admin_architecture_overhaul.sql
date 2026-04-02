-- Admin Architecture Overhaul
-- 1. Semantic Roles Expansion
ALTER TABLE public.profiles 
DROP CONSTRAINT IF EXISTS profiles_role_check;

ALTER TABLE public.profiles
ADD CONSTRAINT profiles_role_check 
CHECK (role IN ('pending', 'authenticated', 'read-only', 'support', 'admin'));

-- 2. User Locking Pass
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS is_locked boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.profiles.is_locked IS 'If true, user is blocked from all Edge Function actions.';

-- 3. Audit Logging (Append-Only Ledger)
CREATE TABLE IF NOT EXISTS public.admin_audit_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_uid uuid NOT NULL REFERENCES auth.users(id),
    admin_role text NOT NULL,
    action_type text NOT NULL,
    target_user_id text,
    payload_before jsonb,
    payload_after jsonb,
    reason text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- Index for quick lookup in Monitoring tab
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.admin_audit_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_admin_uid ON public.admin_audit_logs (admin_uid);

-- Enforce Append-Only behavior via Trigger
CREATE OR REPLACE FUNCTION public.prevent_audit_log_mutation()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'admin_audit_logs is an append-only ledger and cannot be modified or deleted.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_prevent_audit_mutation ON public.admin_audit_logs;
CREATE TRIGGER tr_prevent_audit_mutation
BEFORE UPDATE OR DELETE ON public.admin_audit_logs
FOR EACH ROW EXECUTE FUNCTION public.prevent_audit_log_mutation();

-- RLS: Only service_role (Edge Functions) can touch audit logs
ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "audit_logs_service_access" ON public.admin_audit_logs;
CREATE POLICY "audit_logs_service_access"
ON public.admin_audit_logs
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- 4. Admin Access Policy for Profiles (Allow Admins to see all profiles)
DROP POLICY IF EXISTS "admins_view_all_profiles" ON public.profiles;
CREATE POLICY "admins_view_all_profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  (SELECT role FROM public.profiles WHERE auth_user_id = auth.uid()::text) IN ('admin', 'support', 'read-only')
);
