import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getTenantId, getActiveConnection } from '@/lib/get-connection';

// GET /api/catalog - List app catalog for current tenant
export async function GET() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const tenantId = await getTenantId(supabase, user.id);
  if (!tenantId) return NextResponse.json({ error: 'No tenant found' }, { status: 404 });

  const { data: catalog, error } = await supabase
    .from('app_catalog')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('is_visible', true)
    .order('sort_order', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ catalog });
}

// PATCH /api/catalog - Update display fields only (name, icon, sort order)
// Resource fields (compute_pool, postgres_instance) come from Snowflake via sync.
export async function PATCH(request: Request) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const tenantId = await getTenantId(supabase, user.id);
  if (!tenantId) return NextResponse.json({ error: 'No tenant found' }, { status: 404 });

  const body = await request.json();
  const { id, displayName, iconEmoji, sortOrder, endpointUrl, appComment, appCategory } = body;

  if (!id) {
    return NextResponse.json({ error: 'id is required' }, { status: 400 });
  }

  const updates: Record<string, unknown> = {};
  if (displayName !== undefined) updates.display_name = displayName || null;
  if (iconEmoji !== undefined) updates.icon_emoji = iconEmoji || null;
  if (sortOrder !== undefined) updates.sort_order = sortOrder;
  if (endpointUrl !== undefined) updates.endpoint_url = endpointUrl || null;
  if (appComment !== undefined) updates.app_comment = appComment || null;
  if (appCategory !== undefined) updates.category = appCategory || null;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('app_catalog')
    .update(updates)
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ app: data });
}

// DELETE /api/catalog - Hide an app from the gallery (set is_visible = false)
export async function DELETE(request: Request) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const tenantId = await getTenantId(supabase, user.id);
  if (!tenantId) return NextResponse.json({ error: 'No tenant found' }, { status: 404 });

  const { searchParams } = new URL(request.url);
  const appId = searchParams.get('id');
  if (!appId) return NextResponse.json({ error: 'id is required' }, { status: 400 });

  const { error } = await supabase
    .from('app_catalog')
    .update({ is_visible: false })
    .eq('id', appId)
    .eq('tenant_id', tenantId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
