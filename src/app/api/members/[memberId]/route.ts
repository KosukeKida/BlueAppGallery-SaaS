import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

// PATCH /api/members/[memberId] - Update member role
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ memberId: string }> }
) {
  const { memberId } = await params;
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

  // Only owner can change roles
  if (currentMember.role !== 'owner') {
    return NextResponse.json({ error: 'Only the owner can change member roles' }, { status: 403 });
  }

  const { role } = await request.json();

  if (!role || !['owner', 'admin', 'member'].includes(role)) {
    return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
  }

  const admin = createAdminClient();

  // Verify target member exists in same tenant
  const { data: targetMember, error: fetchError } = await admin
    .from('tenant_members')
    .select('id, user_id, role')
    .eq('id', memberId)
    .eq('tenant_id', currentMember.tenant_id)
    .single();

  if (fetchError || !targetMember) {
    return NextResponse.json({ error: 'Member not found' }, { status: 404 });
  }

  // Cannot change own role
  if (targetMember.user_id === user.id) {
    return NextResponse.json({ error: 'Cannot change your own role' }, { status: 400 });
  }

  const { error } = await admin
    .from('tenant_members')
    .update({ role })
    .eq('id', memberId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

// DELETE /api/members/[memberId] - Remove member from tenant
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ memberId: string }> }
) {
  const { memberId } = await params;
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

  // Only owner can remove members
  if (currentMember.role !== 'owner') {
    return NextResponse.json({ error: 'Only the owner can remove members' }, { status: 403 });
  }

  const admin = createAdminClient();

  // Verify target member
  const { data: targetMember, error: fetchError } = await admin
    .from('tenant_members')
    .select('id, user_id')
    .eq('id', memberId)
    .eq('tenant_id', currentMember.tenant_id)
    .single();

  if (fetchError || !targetMember) {
    return NextResponse.json({ error: 'Member not found' }, { status: 404 });
  }

  // Cannot remove self
  if (targetMember.user_id === user.id) {
    return NextResponse.json({ error: 'Cannot remove yourself from the organization' }, { status: 400 });
  }

  const { error } = await admin
    .from('tenant_members')
    .delete()
    .eq('id', memberId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
