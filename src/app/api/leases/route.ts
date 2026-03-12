import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getTenantId, getActiveConnection } from '@/lib/get-connection';
import { launchApp, refreshLeaseStatuses } from '@/lib/lease-engine';

export const maxDuration = 60;

// GET /api/leases - List leases for current tenant
// Use ?quick=true to skip Snowflake refresh (fast Supabase-only read)
export async function GET(request: Request) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const tenantId = await getTenantId(supabase, user.id);
  if (!tenantId) return NextResponse.json({ error: 'No tenant found' }, { status: 404 });

  const url = new URL(request.url);
  const quick = url.searchParams.get('quick') === 'true';

  // Full mode: refresh statuses from Snowflake (slow, calls Snowflake API)
  if (!quick) {
    const connection = await getActiveConnection(supabase, tenantId);
    if (connection) {
      try {
        await refreshLeaseStatuses({ supabase, connection, tenantId });
      } catch {
        // Refresh is best-effort; continue with local data
      }
    }
  }

  const { data: leases, error } = await supabase
    .from('leases')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ leases });
}

// POST /api/leases - Launch an app (Operator derives resources from catalog)
export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const tenantId = await getTenantId(supabase, user.id);
  if (!tenantId) return NextResponse.json({ error: 'No tenant found' }, { status: 404 });

  const connection = await getActiveConnection(supabase, tenantId);
  if (!connection) return NextResponse.json({ error: 'No active connection configured' }, { status: 400 });

  const body = await request.json();
  const { appName, durationMinutes = 30 } = body;

  if (!appName) {
    return NextResponse.json({ error: 'appName is required' }, { status: 400 });
  }

  try {
    const result = await launchApp({
      supabase,
      connection,
      appName,
      durationMinutes,
      userId: user.id,
      userName: user.email ?? undefined,
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error, code: result.code }, { status: 502 });
    }

    return NextResponse.json({ lease: result.data }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to launch app' },
      { status: 502 }
    );
  }
}
