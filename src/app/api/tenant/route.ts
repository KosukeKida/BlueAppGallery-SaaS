import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

// GET /api/tenant - Get current tenant info
export async function GET() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const { data: member } = await supabase
    .from('tenant_members')
    .select('tenant_id, role')
    .eq('user_id', user.id)
    .single();

  if (!member) {
    return NextResponse.json({ error: 'No tenant found' }, { status: 404 });
  }

  const { data: tenant, error } = await supabase
    .from('tenants')
    .select('id, name, plan, created_at')
    .eq('id', member.tenant_id)
    .single();

  if (error || !tenant) {
    return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
  }

  // Count members
  const { count: memberCount } = await supabase
    .from('tenant_members')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', member.tenant_id);

  // Count connections
  const { count: connectionCount } = await supabase
    .from('snowflake_connections')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', member.tenant_id);

  return NextResponse.json({
    tenant: {
      ...tenant,
      member_count: memberCount ?? 0,
      connection_count: connectionCount ?? 0,
    },
    role: member.role,
  });
}

// PATCH /api/tenant - Update tenant info
export async function PATCH(request: Request) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const { data: member } = await supabase
    .from('tenant_members')
    .select('tenant_id, role')
    .eq('user_id', user.id)
    .single();

  if (!member) {
    return NextResponse.json({ error: 'No tenant found' }, { status: 404 });
  }

  // Only owner can update tenant
  if (member.role !== 'owner') {
    return NextResponse.json({ error: 'Only the tenant owner can update settings' }, { status: 403 });
  }

  const body = await request.json();
  const updateData: Record<string, unknown> = {};

  if (body.name !== undefined) updateData.name = body.name;

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
  }

  const { data: tenant, error } = await supabase
    .from('tenants')
    .update(updateData)
    .eq('id', member.tenant_id)
    .select('id, name, plan, created_at')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ tenant });
}
