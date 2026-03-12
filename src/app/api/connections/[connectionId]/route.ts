import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export const maxDuration = 60;

// PATCH /api/connections/[connectionId] - Update a connection
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ connectionId: string }> }
) {
  const { connectionId } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  // Verify the connection exists and belongs to user's tenant (RLS)
  const { data: existing, error: fetchError } = await supabase
    .from('snowflake_connections')
    .select('id')
    .eq('id', connectionId)
    .single();

  if (fetchError || !existing) {
    return NextResponse.json({ error: 'Connection not found' }, { status: 404 });
  }

  const body = await request.json();
  const updateData: Record<string, unknown> = {};

  // Only update fields that are provided
  if (body.displayName !== undefined) updateData.display_name = body.displayName;
  if (body.accountIdentifier !== undefined) updateData.account_identifier = body.accountIdentifier;
  if (body.accountLocator !== undefined) updateData.account_locator = body.accountLocator;
  if (body.username !== undefined) updateData.username = body.username;
  if (body.role !== undefined) updateData.role = body.role;
  if (body.database !== undefined) updateData.database = body.database;
  if (body.warehouse !== undefined) updateData.warehouse = body.warehouse || null;
  // Private key is optional on update — only set if provided
  if (body.privateKey) updateData.encrypted_private_key = body.privateKey;

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
  }

  const { data: connection, error } = await supabase
    .from('snowflake_connections')
    .update(updateData)
    .eq('id', connectionId)
    .select('id, display_name, account_identifier, account_locator, username, role, database, schema_name, warehouse, is_active, last_tested_at, last_test_result, created_at')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ connection });
}

// DELETE /api/connections/[connectionId] - Delete a connection
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ connectionId: string }> }
) {
  const { connectionId } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  // Check for active leases using this connection
  const { data: activeLeases } = await supabase
    .from('leases')
    .select('id')
    .eq('connection_id', connectionId)
    .eq('status', 'ACTIVE')
    .limit(1);

  if (activeLeases && activeLeases.length > 0) {
    return NextResponse.json(
      { error: 'Cannot delete connection with active leases. Stop all leases first.' },
      { status: 409 }
    );
  }

  const { error } = await supabase
    .from('snowflake_connections')
    .delete()
    .eq('id', connectionId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
