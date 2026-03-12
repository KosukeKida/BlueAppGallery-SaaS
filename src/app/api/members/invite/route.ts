import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

// POST /api/members/invite - Invite a new member by email
export async function POST(request: Request) {
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

  // Only owner/admin can invite
  if (!['owner', 'admin'].includes(currentMember.role)) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }

  const { email, role } = await request.json();

  if (!email) {
    return NextResponse.json({ error: 'Email is required' }, { status: 400 });
  }

  const memberRole = role || 'member';
  if (!['admin', 'member'].includes(memberRole)) {
    return NextResponse.json({ error: 'Invalid role. Must be admin or member.' }, { status: 400 });
  }

  const admin = createAdminClient();

  // Check if user already exists in auth
  const { data: { users } } = await admin.auth.admin.listUsers();
  const existingUser = users?.find(u => u.email === email);

  if (existingUser) {
    // Check if already a member of this tenant
    const { data: existingMember } = await admin
      .from('tenant_members')
      .select('id')
      .eq('tenant_id', currentMember.tenant_id)
      .eq('user_id', existingUser.id)
      .single();

    if (existingMember) {
      return NextResponse.json({ error: 'User is already a member of this organization' }, { status: 409 });
    }

    // Add existing user to tenant
    const { error: insertError } = await admin
      .from('tenant_members')
      .insert({
        tenant_id: currentMember.tenant_id,
        user_id: existingUser.id,
        role: memberRole,
      });

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, method: 'added', email });
  }

  // User doesn't exist — invite via Supabase Auth
  const { data: inviteData, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email);

  if (inviteError) {
    return NextResponse.json({ error: inviteError.message }, { status: 500 });
  }

  // Add invited user to tenant
  const { error: insertError } = await admin
    .from('tenant_members')
    .insert({
      tenant_id: currentMember.tenant_id,
      user_id: inviteData.user.id,
      role: memberRole,
    });

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, method: 'invited', email });
}
