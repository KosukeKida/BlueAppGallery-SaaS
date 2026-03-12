import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getActiveConnection } from '@/lib/get-connection';
import { stopLease } from '@/lib/lease-engine';

export const maxDuration = 60;

// GET /api/leases/[leaseId] - Get lease details
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ leaseId: string }> }
) {
  const { leaseId } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const { data: lease, error } = await supabase
    .from('leases')
    .select('*')
    .eq('id', leaseId)
    .single();

  if (error || !lease) return NextResponse.json({ error: 'Lease not found' }, { status: 404 });

  return NextResponse.json({ lease });
}

// DELETE /api/leases/[leaseId] - Stop a lease
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ leaseId: string }> }
) {
  const { leaseId } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  // Fetch the lease (RLS ensures tenant isolation)
  const { data: lease, error: fetchError } = await supabase
    .from('leases')
    .select('*')
    .eq('id', leaseId)
    .single();

  if (fetchError || !lease) return NextResponse.json({ error: 'Lease not found' }, { status: 404 });

  if (lease.status !== 'ACTIVE') {
    return NextResponse.json({ error: 'Lease is not active' }, { status: 400 });
  }

  const connection = await getActiveConnection(supabase, lease.tenant_id);
  if (!connection) return NextResponse.json({ error: 'No active connection' }, { status: 400 });

  try {
    const result = await stopLease({
      supabase,
      connection,
      snowflakeLeaseId: lease.snowflake_lease_id,
      localLeaseId: lease.id,
      userId: user.id,
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 502 });
    }

    return NextResponse.json({ result: result.data });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to stop lease' },
      { status: 502 }
    );
  }
}
