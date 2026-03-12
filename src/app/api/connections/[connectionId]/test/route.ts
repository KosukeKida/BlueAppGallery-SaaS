import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createSnowflakeClient } from '@/lib/lease-engine';

export const maxDuration = 60;

// POST /api/connections/[connectionId]/test - Test a Snowflake connection
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ connectionId: string }> }
) {
  const { connectionId } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  // Fetch the connection (RLS ensures tenant isolation)
  const { data: connection, error: fetchError } = await supabase
    .from('snowflake_connections')
    .select('*')
    .eq('id', connectionId)
    .single();

  if (fetchError || !connection) {
    return NextResponse.json({ error: 'Connection not found' }, { status: 404 });
  }

  if (!connection.encrypted_private_key) {
    return NextResponse.json({ error: 'Private key not configured' }, { status: 400 });
  }

  // Create Snowflake client and test via api.get_version()
  const client = createSnowflakeClient(connection);
  const result = await client.testConnection();

  // Update test result in DB
  await supabase
    .from('snowflake_connections')
    .update({
      last_tested_at: new Date().toISOString(),
      last_test_result: result.ok ? 'OK' : result.error ?? 'Unknown error',
    })
    .eq('id', connectionId);

  if (result.ok) {
    return NextResponse.json({
      ok: true,
      version: result.version,
      compatible: result.compatible,
    });
  }

  return NextResponse.json({
    ok: false,
    error: result.error,
  }, { status: 502 });
}
