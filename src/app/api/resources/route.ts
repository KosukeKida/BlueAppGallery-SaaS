import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getTenantId, getActiveConnection } from '@/lib/get-connection';
import { createSnowflakeClient } from '@/lib/lease-engine';

export const maxDuration = 60;

// GET /api/resources - List managed apps from Snowflake Operator
export async function GET() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const tenantId = await getTenantId(supabase, user.id);
  if (!tenantId) return NextResponse.json({ error: 'No tenant found' }, { status: 404 });

  const connection = await getActiveConnection(supabase, tenantId);
  if (!connection || !connection.encrypted_private_key) {
    return NextResponse.json({ apps: [], total_count: 0 });
  }

  const client = createSnowflakeClient(connection);

  try {
    const response = await client.listApps();
    if (response.status === 'OK' && response.data) {
      return NextResponse.json(response.data);
    }
    return NextResponse.json({ apps: [], total_count: 0 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error), apps: [], total_count: 0 },
      { status: 502 }
    );
  }
}
