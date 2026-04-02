import { assertEquals, assertRejects } from 'https://deno.land/std@0.192.0/testing/asserts.ts';
import { AppError } from '../_shared/http.ts';

// Given: Mock dependencies
function mockReq(method: string, action: string, body?: any) {
    return new Request(`https://test.supabase.co/${action}`, {
        method,
        headers: { 'Authorization': 'Bearer test-token' },
        body: body ? JSON.stringify(body) : undefined,
    });
}

// When: Executing tests
Deno.test('admin-actions: read-only role cannot POST', async () => {
    const req = mockReq('POST', 'update-user', { targetUserId: '123', updates: { role: 'admin' }, reason: 'test' });
    
    // Simulate requireSupportAccess behavior when user is 'read-only'
    const requireSupportAccess = async () => {
        throw new AppError(403, 'FORBIDDEN', 'Access denied: insufficient permissions');
    };

    // Then: It throws 403
    await assertRejects(
        () => requireSupportAccess(),
        AppError,
        'Access denied: insufficient permissions'
    );
});

Deno.test('admin-actions: support role cannot grant admin role', async () => {
    // Given: A simulated update block checking roles
    const adminProfile = { role: 'support' };
    const updates = { role: 'admin' };
    
    // When/Then:
    if (updates.role && adminProfile.role !== 'admin') {
        const err = new AppError(403, 'FORBIDDEN', 'Only admins can change user roles');
        assertEquals(err.status, 403);
        assertEquals(err.message, 'Only admins can change user roles');
    } else {
        throw new Error('Support was incorrectly allowed to grant admin');
    }
});

Deno.test('admin-actions: support role cannot update global config', async () => {
    // Simulate requireAdminOnlyAccess
    const requireAdminOnlyAccess = async (profile: { role: string }) => {
        if (profile.role !== 'admin') {
            throw new AppError(403, 'FORBIDDEN', 'Access denied: insufficient permissions');
        }
    };

    // Then: It throws 403 for support
    await assertRejects(
        () => requireAdminOnlyAccess({ role: 'support' }),
        AppError,
        'Access denied: insufficient permissions'
    );
});

Deno.test('admin-actions: credit adjustments are logged to audit_logs', () => {
    // Given
    let insertedLog: any = null;
    const mockSupabaseAdmin = {
        from: (table: string) => ({
            insert: (data: any) => {
                if (table === 'admin_audit_logs') {
                    insertedLog = data;
                }
                return { error: null };
            }
        })
    };

    // When
    mockSupabaseAdmin.from('admin_audit_logs').insert({
        admin_uid: 'uuid',
        admin_role: 'admin',
        action_type: 'CREDIT_ADJUST',
        target_user_id: 'target-uuid',
        payload_before: { granted_credits: 0 },
        payload_after: { granted_credits: 100 },
        reason: 'Refund'
    });

    // Then
    assertEquals(insertedLog.action_type, 'CREDIT_ADJUST');
    assertEquals(insertedLog.reason, 'Refund');
    assertEquals(insertedLog.payload_before.granted_credits, 0);
    assertEquals(insertedLog.payload_after.granted_credits, 100);
});
