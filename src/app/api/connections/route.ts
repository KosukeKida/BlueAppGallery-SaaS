import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

// GET /api/connections - List connections for current tenant
export async function GET() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  // Get user's tenant
  const { data: member } = await supabase
    .from('tenant_members')
    .select('tenant_id')
    .eq('user_id', user.id)
    .single();

  if (!member) {
    return NextResponse.json({ error: 'No tenant found' }, { status: 404 });
  }

  const { data: connections, error } = await supabase
    .from('snowflake_connections')
    .select('id, display_name, account_identifier, account_locator, username, warehouse, role, database, schema_name, is_active, last_tested_at, last_test_result, created_at')
    .eq('tenant_id', member.tenant_id)
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ connections });
}

// POST /api/connections - Create a new connection
export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const { data: member } = await supabase
    .from('tenant_members')
    .select('tenant_id')
    .eq('user_id', user.id)
    .single();

  if (!member) {
    return NextResponse.json({ error: 'No tenant found' }, { status: 404 });
  }

  const body = await request.json();
  const {
    displayName,
    accountIdentifier,
    accountLocator,
    username,
    privateKey,
    warehouse,
    role,
    database,
    schemaName,
  } = body;

  if (!accountIdentifier || !accountLocator || !username || !privateKey) {
    return NextResponse.json(
      { error: 'accountIdentifier, accountLocator, username, and privateKey are required' },
      { status: 400 }
    );
  }

  const { data: connection, error } = await supabase
    .from('snowflake_connections')
    .insert({
      tenant_id: member.tenant_id,
      display_name: displayName || 'Default',
      account_identifier: accountIdentifier,
      account_locator: accountLocator,
      username,
      encrypted_private_key: privateKey,
      warehouse: warehouse || null,
      role: role || 'gallery_saas_role',
      database: database || 'APP_GALLERY_OPERATOR',
      schema_name: schemaName || 'core',
    })
    .select('id, display_name, account_identifier, username, role, database, schema_name, is_active, created_at')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ connection }, { status: 201 });
}
