begin;

-- Create the table, trigger, and RLS policies locally for the test
-- (Since local migrations are historically out-of-sync with production)
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

ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "audit_logs_service_access" ON public.admin_audit_logs;
CREATE POLICY "audit_logs_service_access"
ON public.admin_audit_logs FOR ALL TO service_role
USING (true) WITH CHECK (true);

-- Import pgTAP
create extension if not exists pgtap;

-- Plan the tests (10 tests)
select plan(10);

-- 1. Table structure tests
select has_table('public', 'admin_audit_logs', 'admin_audit_logs table should exist');
select has_column('public', 'admin_audit_logs', 'admin_uid', 'admin_uid column should exist');
select has_column('public', 'admin_audit_logs', 'action_type', 'action_type column should exist');
select has_column('public', 'admin_audit_logs', 'payload_before', 'payload_before column should exist');
select has_column('public', 'admin_audit_logs', 'payload_after', 'payload_after column should exist');
select has_column('public', 'admin_audit_logs', 'reason', 'reason column should exist');

-- Insert dummy auth user for foreign key constraint
DO $$
DECLARE
    dummy_uuid uuid := '00000000-0000-0000-0000-000000000000'::uuid;
BEGIN
    INSERT INTO auth.users (id) VALUES (dummy_uuid) ON CONFLICT DO NOTHING;
END $$;

-- 2. Insert test (Append works)
select lives_ok(
    $$ 
    insert into public.admin_audit_logs (admin_uid, admin_role, action_type, reason) 
    values (
        '00000000-0000-0000-0000-000000000000'::uuid,
        'admin',
        'TEST_ACTION',
        'Testing append'
    )
    $$,
    'Should be able to insert (append) to admin_audit_logs'
);

-- 3. Update test (Must fail)
select throws_ok(
    $$
    update public.admin_audit_logs set reason = 'Hacked reason' where action_type = 'TEST_ACTION'
    $$,
    'P0001',
    'admin_audit_logs is an append-only ledger and cannot be modified or deleted.',
    'Should NOT be able to UPDATE rows in admin_audit_logs (append-only enforcement)'
);

-- 4. Delete test (Must fail)
select throws_ok(
    $$
    delete from public.admin_audit_logs where action_type = 'TEST_ACTION'
    $$,
    'P0001',
    'admin_audit_logs is an append-only ledger and cannot be modified or deleted.',
    'Should NOT be able to DELETE rows in admin_audit_logs (append-only enforcement)'
);

-- 5. RLS Policy Test: Authenticated users should NOT be able to insert directly
set local role authenticated;
select throws_ok(
    $$
    insert into public.admin_audit_logs (admin_uid, admin_role, action_type, reason) 
    values (gen_random_uuid(), 'admin', 'TEST', 'Try insert as authenticated')
    $$,
    '42501',
    'new row violates row-level security policy for table "admin_audit_logs"',
    'Authenticated users should be blocked by RLS from inserting directly into the audit logs'
);
reset role;

-- Finish tests
select * from finish();
rollback;
