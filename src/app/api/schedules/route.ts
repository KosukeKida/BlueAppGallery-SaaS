import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getTenantId } from '@/lib/get-connection';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function requireAdmin(supabase: any, userId: string, tenantId: string) {
  const { data } = await supabase
    .from('tenant_members')
    .select('role')
    .eq('user_id', userId)
    .eq('tenant_id', tenantId)
    .single();
  return data?.role === 'admin' || data?.role === 'owner';
}

// GET /api/schedules - List schedules for current tenant
export async function GET() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const tenantId = await getTenantId(supabase, user.id);
  if (!tenantId) return NextResponse.json({ error: 'No tenant found' }, { status: 404 });

  const { data: schedules, error } = await supabase
    .from('app_schedules')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('app_name', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ schedules: schedules || [] });
}

// POST /api/schedules - Create a new schedule
export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const tenantId = await getTenantId(supabase, user.id);
  if (!tenantId) return NextResponse.json({ error: 'No tenant found' }, { status: 404 });

  if (!await requireAdmin(supabase, user.id, tenantId)) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  const body = await request.json();
  const { connectionId, appName, label, daysOfWeek, startTime, stopTime, timezone } = body;

  if (!connectionId || !appName || !daysOfWeek?.length || !startTime || !stopTime) {
    return NextResponse.json({ error: 'connectionId, appName, daysOfWeek, startTime, and stopTime are required' }, { status: 400 });
  }

  // Validate stop_time > start_time
  if (stopTime <= startTime) {
    return NextResponse.json({ error: 'stopTime must be after startTime' }, { status: 400 });
  }

  // Validate days_of_week values (1-7)
  if (!daysOfWeek.every((d: number) => d >= 1 && d <= 7)) {
    return NextResponse.json({ error: 'daysOfWeek must contain values 1-7' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('app_schedules')
    .insert({
      tenant_id: tenantId,
      connection_id: connectionId,
      app_name: appName,
      label: label || null,
      days_of_week: daysOfWeek,
      start_time: startTime,
      stop_time: stopTime,
      timezone: timezone || 'Asia/Tokyo',
      created_by: user.id,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ schedule: data });
}

// PATCH /api/schedules - Update a schedule
export async function PATCH(request: Request) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const tenantId = await getTenantId(supabase, user.id);
  if (!tenantId) return NextResponse.json({ error: 'No tenant found' }, { status: 404 });

  if (!await requireAdmin(supabase, user.id, tenantId)) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  const body = await request.json();
  const { id, label, daysOfWeek, startTime, stopTime, timezone, isEnabled } = body;

  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

  // Validate stop_time > start_time if both provided
  if (startTime && stopTime && stopTime <= startTime) {
    return NextResponse.json({ error: 'stopTime must be after startTime' }, { status: 400 });
  }

  if (daysOfWeek && !daysOfWeek.every((d: number) => d >= 1 && d <= 7)) {
    return NextResponse.json({ error: 'daysOfWeek must contain values 1-7' }, { status: 400 });
  }

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (label !== undefined) updates.label = label || null;
  if (daysOfWeek !== undefined) updates.days_of_week = daysOfWeek;
  if (startTime !== undefined) updates.start_time = startTime;
  if (stopTime !== undefined) updates.stop_time = stopTime;
  if (timezone !== undefined) updates.timezone = timezone;
  if (isEnabled !== undefined) updates.is_enabled = isEnabled;

  const { data, error } = await supabase
    .from('app_schedules')
    .update(updates)
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ schedule: data });
}

// DELETE /api/schedules - Delete a schedule
export async function DELETE(request: Request) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const tenantId = await getTenantId(supabase, user.id);
  if (!tenantId) return NextResponse.json({ error: 'No tenant found' }, { status: 404 });

  if (!await requireAdmin(supabase, user.id, tenantId)) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const scheduleId = searchParams.get('id');
  if (!scheduleId) return NextResponse.json({ error: 'id is required' }, { status: 400 });

  const { error } = await supabase
    .from('app_schedules')
    .delete()
    .eq('id', scheduleId)
    .eq('tenant_id', tenantId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
