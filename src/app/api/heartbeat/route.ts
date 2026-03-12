import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getTenantId, getActiveConnection } from '@/lib/get-connection';
import { recordHeartbeat } from '@/lib/lease-engine';

export const maxDuration = 60;

// POST /api/heartbeat - Send a heartbeat for an active lease
export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const tenantId = await getTenantId(supabase, user.id);
  if (!tenantId) return NextResponse.json({ error: 'No tenant found' }, { status: 404 });

  const connection = await getActiveConnection(supabase, tenantId);
  if (!connection) return NextResponse.json({ error: 'No active connection' }, { status: 400 });

  const body = await request.json();
  const { leaseId, sessionId } = body;

  if (!leaseId) {
    return NextResponse.json({ error: 'leaseId is required' }, { status: 400 });
  }

  // Verify the lease exists and is active (RLS handles tenant isolation)
  const { data: lease, error: fetchError } = await supabase
    .from('leases')
    .select('id, snowflake_lease_id, status')
    .eq('id', leaseId)
    .single();

  if (fetchError || !lease) {
    return NextResponse.json({ error: 'Lease not found' }, { status: 404 });
  }

  if (lease.status !== 'ACTIVE') {
    return NextResponse.json({ error: 'Lease is not active' }, { status: 400 });
  }

  try {
    const result = await recordHeartbeat({
      supabase,
      connection,
      snowflakeLeaseId: lease.snowflake_lease_id,
      localLeaseId: lease.id,
      userId: user.id,
      userName: user.email ?? undefined,
      sessionId,
    });

    return NextResponse.json({ result });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Heartbeat failed' },
      { status: 502 }
    );
  }
}
