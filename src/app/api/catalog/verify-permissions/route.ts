import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getTenantId, getActiveConnection } from '@/lib/get-connection';
import { createSnowflakeClient } from '@/lib/lease-engine';

export const maxDuration = 60;

// POST /api/catalog/verify-permissions - Check permission status for all managed apps
export async function POST() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const tenantId = await getTenantId(supabase, user.id);
  if (!tenantId) return NextResponse.json({ error: 'No tenant found' }, { status: 404 });

  const connection = await getActiveConnection(supabase, tenantId);
  if (!connection) {
    return NextResponse.json({ error: 'No active Snowflake connection' }, { status: 404 });
  }

  if (!connection.encrypted_private_key) {
    return NextResponse.json({ error: 'Private key not configured' }, { status: 400 });
  }

  const client = createSnowflakeClient(connection);

  try {
    const response = await client.verifyPermissions();

    if (response.status === 'ERROR') {
      return NextResponse.json(
        { error: response.error?.message ?? 'Failed to verify permissions' },
        { status: 502 }
      );
    }

    return NextResponse.json({
      status: 'OK',
      data: response.data,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 502 }
    );
  }
}
