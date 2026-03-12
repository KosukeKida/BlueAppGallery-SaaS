import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const { tenantName } = await request.json();

  // Use admin client to bypass RLS for tenant creation
  const admin = createAdminClient();

  // Check if user already has a tenant
  const { data: existing } = await admin
    .from('tenant_members')
    .select('tenant_id')
    .eq('user_id', user.id)
    .single();

  if (existing) {
    return NextResponse.json({ ok: true, tenantId: existing.tenant_id });
  }

  // Create tenant
  const slug = (tenantName || user.email?.split('@')[0] || 'default')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 50);

  const { data: tenant, error: tenantError } = await admin
    .from('tenants')
    .insert({
      name: tenantName || slug,
      slug: `${slug}-${Date.now().toString(36)}`,
    })
    .select()
    .single();

  if (tenantError) {
    return NextResponse.json({ error: tenantError.message }, { status: 500 });
  }

  // Create membership
  const { error: memberError } = await admin
    .from('tenant_members')
    .insert({
      tenant_id: tenant.id,
      user_id: user.id,
      role: 'owner',
    });

  if (memberError) {
    return NextResponse.json({ error: memberError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, tenantId: tenant.id });
}
