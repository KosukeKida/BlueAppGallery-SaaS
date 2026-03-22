import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

// POST /api/tenant/switch - Switch active tenant
export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const { tenantId } = await request.json();
  if (!tenantId) {
    return NextResponse.json({ error: 'tenantId is required' }, { status: 400 });
  }

  // Verify user is a member of the target tenant (use admin client to bypass RLS)
  const admin = createAdminClient();
  const { data: membership } = await admin
    .from('tenant_members')
    .select('tenant_id, role')
    .eq('user_id', user.id)
    .eq('tenant_id', tenantId)
    .single();

  if (!membership) {
    return NextResponse.json({ error: 'Not a member of this tenant' }, { status: 403 });
  }

  // Update app_metadata with the active tenant
  const { error } = await admin.auth.admin.updateUserById(user.id, {
    app_metadata: { active_tenant_id: tenantId },
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Refresh the session so the client gets the new JWT
  await supabase.auth.refreshSession();

  return NextResponse.json({ ok: true, tenantId, role: membership.role });
}
