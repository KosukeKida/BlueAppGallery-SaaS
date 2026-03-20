import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getTenantId } from '@/lib/get-connection';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function requireSaasOwner(supabase: any, userId: string, tenantId: string): Promise<boolean> {
  const saasOwnerTenantId = process.env.SAAS_OWNER_TENANT_ID ?? '';
  if (!saasOwnerTenantId || tenantId !== saasOwnerTenantId) return false;
  const { data } = await supabase
    .from('tenant_members')
    .select('role')
    .eq('user_id', userId)
    .eq('tenant_id', tenantId)
    .single();
  return data?.role === 'admin' || data?.role === 'owner';
}

// GET /api/promotions - List promotion cards for current tenant
export async function GET(request: Request) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const tenantId = await getTenantId(supabase, user.id);
  if (!tenantId) return NextResponse.json({ error: 'No tenant found' }, { status: 404 });

  const { searchParams } = new URL(request.url);
  const activeOnly = searchParams.get('active') !== 'false';

  let query = supabase
    .from('promotion_cards')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('position', { ascending: true });

  if (activeOnly) {
    query = query.eq('is_active', true);
  }

  const { data: cards, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ cards: cards || [] });
}

// POST /api/promotions - Create a new promotion card
export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const tenantId = await getTenantId(supabase, user.id);
  if (!tenantId) return NextResponse.json({ error: 'No tenant found' }, { status: 404 });

  if (!await requireSaasOwner(supabase, user.id, tenantId)) {
    return NextResponse.json({ error: 'SaaS owner access required' }, { status: 403 });
  }

  const body = await request.json();
  const { title, description, imageUrl, linkUrl, position } = body;

  if (!title || !linkUrl) {
    return NextResponse.json({ error: 'title and linkUrl are required' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('promotion_cards')
    .insert({
      tenant_id: tenantId,
      title,
      description: description || null,
      image_url: imageUrl || null,
      link_url: linkUrl,
      position: position ?? 0,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ card: data });
}

// PATCH /api/promotions - Update a promotion card
export async function PATCH(request: Request) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const tenantId = await getTenantId(supabase, user.id);
  if (!tenantId) return NextResponse.json({ error: 'No tenant found' }, { status: 404 });

  if (!await requireSaasOwner(supabase, user.id, tenantId)) {
    return NextResponse.json({ error: 'SaaS owner access required' }, { status: 403 });
  }

  const body = await request.json();
  const { id, title, description, imageUrl, linkUrl, position, isActive } = body;

  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (title !== undefined) updates.title = title;
  if (description !== undefined) updates.description = description || null;
  if (imageUrl !== undefined) updates.image_url = imageUrl || null;
  if (linkUrl !== undefined) updates.link_url = linkUrl;
  if (position !== undefined) updates.position = position;
  if (isActive !== undefined) updates.is_active = isActive;

  const { data, error } = await supabase
    .from('promotion_cards')
    .update(updates)
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ card: data });
}

// DELETE /api/promotions - Delete a promotion card
export async function DELETE(request: Request) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const tenantId = await getTenantId(supabase, user.id);
  if (!tenantId) return NextResponse.json({ error: 'No tenant found' }, { status: 404 });

  if (!await requireSaasOwner(supabase, user.id, tenantId)) {
    return NextResponse.json({ error: 'SaaS owner access required' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const cardId = searchParams.get('id');
  if (!cardId) return NextResponse.json({ error: 'id is required' }, { status: 400 });

  const { error } = await supabase
    .from('promotion_cards')
    .delete()
    .eq('id', cardId)
    .eq('tenant_id', tenantId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
