import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { executeSchedules } from '@/lib/schedule-engine';

/**
 * POST /api/schedules/execute
 *
 * Cron endpoint called by Supabase pg_cron every minute.
 * Protected by CRON_SECRET — not accessible to regular users.
 */
export async function POST(request: Request) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 });
  }

  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const adminSupabase = createAdminClient();
    const results = await executeSchedules(adminSupabase);

    return NextResponse.json({
      ok: true,
      executed: results.length,
      results,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
