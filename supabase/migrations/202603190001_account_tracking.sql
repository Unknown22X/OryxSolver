-- Account creation tracking to prevent spam accounts
CREATE TABLE IF NOT EXISTS public.account_creation_tracking (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_address text NOT NULL,
  email text,
  user_id uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_account_tracking_ip 
ON public.account_creation_tracking (ip_address, created_at);

ALTER TABLE public.account_creation_tracking ENABLE ROW LEVEL SECURITY;

CREATE POLICY "account_tracking_service" ON public.account_creation_tracking
FOR ALL TO authenticated USING (false) WITH CHECK (false);
