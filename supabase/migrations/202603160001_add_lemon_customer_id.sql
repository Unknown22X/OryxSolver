-- Add lemon_customer_id column to profiles for Lemon Squeezy integration
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS lemon_customer_id TEXT;

CREATE INDEX IF NOT EXISTS idx_profiles_lemon_customer_id 
ON public.profiles (lemon_customer_id) 
WHERE lemon_customer_id IS NOT NULL;
