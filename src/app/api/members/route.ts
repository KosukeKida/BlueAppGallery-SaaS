import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

// GET /api/members - List tenant members
export async function GET() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const { data: currentMember } = await supabase
    .from('tenant_members')
    .select('tenant_id, role')
    .eq('user_id', user.id)
    .single();

  if (!currentMember) {
    return NextResponse.json({ error: 'No tenant found' }, { status: 404 });
  }

  // Use admin client to join auth.users for email
  const admin = createAdminClient();
  const { data: members, error } = await admin
    .from('tenant_members')
    .select('id, user_id, role, created_at')
    .eq('tenant_id', currentMember.tenant_id)
    .order('created_at', { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Resolve emails from auth.users
  const enriched = await Promise.all(
    (members ?? []).map(async (m) => {
      const { data: { user: authUser } } = await admin.auth.admin.getUserById(m.user_id);
      return {
        ...m,
        email: authUser?.email ?? 'unknown',
        is_current: m.user_id === user.id,
      };
    })
  );

  return NextResponse.json({
    members: enriched,
    current_role: currentMember.role,
  });
}
