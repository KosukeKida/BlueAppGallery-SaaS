import { SupabaseClient } from '@supabase/supabase-js';
import { launchApp, stopLease, createSnowflakeClient } from './lease-engine';

// ============================================================
// Types
// ============================================================

interface ScheduleRecord {
  id: string;
  tenant_id: string;
  connection_id: string;
  app_name: string;
  label: string | null;
  days_of_week: number[];
  start_time: string; // "HH:MM:SS"
  stop_time: string;
  timezone: string;
  is_enabled: boolean;
}

interface ConnectionRecord {
  id: string;
  tenant_id: string;
  account_identifier: string;
  account_locator: string;
  username: string;
  encrypted_private_key: string;
  database: string;
  role: string;
  warehouse: string | null;
}

// ============================================================
// Time matching
// ============================================================

/**
 * Get the current day-of-week (ISO 8601: 1=Mon, 7=Sun) and
 * time-of-day in minutes, in the given IANA timezone.
 */
function getNowInTimezone(timezone: string): { dayOfWeek: number; minuteOfDay: number } {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    weekday: 'short',
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
  });
  const parts = formatter.formatToParts(now);

  const weekdayStr = parts.find(p => p.type === 'weekday')?.value ?? '';
  const hour = parseInt(parts.find(p => p.type === 'hour')?.value ?? '0', 10);
  const minute = parseInt(parts.find(p => p.type === 'minute')?.value ?? '0', 10);

  const dayMap: Record<string, number> = {
    Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7,
  };

  return {
    dayOfWeek: dayMap[weekdayStr] ?? 1,
    minuteOfDay: hour * 60 + minute,
  };
}

/**
 * Parse a TIME string "HH:MM" or "HH:MM:SS" to minutes of day.
 */
function timeToMinutes(time: string): number {
  const parts = time.split(':');
  return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
}

/**
 * Determine what action (if any) should be triggered for a schedule.
 */
export function shouldTrigger(
  schedule: ScheduleRecord,
  now?: { dayOfWeek: number; minuteOfDay: number },
): 'START' | 'STOP' | null {
  const { dayOfWeek, minuteOfDay } = now ?? getNowInTimezone(schedule.timezone);

  if (!schedule.days_of_week.includes(dayOfWeek)) return null;

  const startMin = timeToMinutes(schedule.start_time);
  const stopMin = timeToMinutes(schedule.stop_time);

  if (minuteOfDay === startMin) return 'START';
  if (minuteOfDay === stopMin) return 'STOP';

  return null;
}

// ============================================================
// Execute all schedules
// ============================================================

interface ExecutionResult {
  scheduleId: string;
  appName: string;
  action: 'START' | 'STOP';
  status: 'OK' | 'ERROR' | 'SKIPPED';
  message?: string;
}

/**
 * Execute all enabled schedules across all tenants.
 * Called by the cron endpoint with an admin (service role) client.
 */
export async function executeSchedules(adminSupabase: SupabaseClient): Promise<ExecutionResult[]> {
  // Fetch all enabled schedules (bypasses RLS via service role)
  const { data: schedules, error } = await adminSupabase
    .from('app_schedules')
    .select('*')
    .eq('is_enabled', true);

  if (error || !schedules || schedules.length === 0) {
    return [];
  }

  const results: ExecutionResult[] = [];

  // Group schedules by connection_id to batch connection lookups
  const connectionIds = [...new Set(schedules.map(s => s.connection_id))];
  const { data: connections } = await adminSupabase
    .from('snowflake_connections')
    .select('*')
    .in('id', connectionIds);

  const connectionMap = new Map<string, ConnectionRecord>();
  for (const conn of connections ?? []) {
    connectionMap.set(conn.id, conn);
  }

  for (const schedule of schedules) {
    const action = shouldTrigger(schedule);
    if (!action) continue;

    const connection = connectionMap.get(schedule.connection_id);
    if (!connection) {
      await updateTriggerStatus(adminSupabase, schedule.id, action, 'ERROR', 'Connection not found');
      results.push({ scheduleId: schedule.id, appName: schedule.app_name, action, status: 'ERROR', message: 'Connection not found' });
      continue;
    }

    try {
      if (action === 'START') {
        const result = await executeStart(adminSupabase, connection, schedule);
        results.push(result);
      } else {
        const result = await executeStop(adminSupabase, connection, schedule);
        results.push(result);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await updateTriggerStatus(adminSupabase, schedule.id, action, 'ERROR', message);
      results.push({ scheduleId: schedule.id, appName: schedule.app_name, action, status: 'ERROR', message });
    }
  }

  return results;
}

// ============================================================
// Start / Stop execution
// ============================================================

async function executeStart(
  supabase: SupabaseClient,
  connection: ConnectionRecord,
  schedule: ScheduleRecord,
): Promise<ExecutionResult> {
  // Calculate duration from start_time to stop_time
  const startMin = timeToMinutes(schedule.start_time);
  const stopMin = timeToMinutes(schedule.stop_time);
  const durationMinutes = stopMin - startMin;

  if (durationMinutes <= 0) {
    await updateTriggerStatus(supabase, schedule.id, 'START', 'ERROR', 'Invalid duration: stop_time must be after start_time');
    return { scheduleId: schedule.id, appName: schedule.app_name, action: 'START', status: 'ERROR', message: 'Invalid duration' };
  }

  const result = await launchApp({
    supabase,
    connection,
    appName: schedule.app_name,
    durationMinutes,
    userId: 'SCHEDULER',
    userName: 'SCHEDULER',
  });

  if (result.ok) {
    await updateTriggerStatus(supabase, schedule.id, 'START', 'OK');
    await auditLog(supabase, connection.tenant_id, 'SCHEDULE_STARTED', 'schedule', schedule.id, 'SCHEDULER', {
      app_name: schedule.app_name,
      schedule_label: schedule.label,
      duration_minutes: durationMinutes,
    });
    return { scheduleId: schedule.id, appName: schedule.app_name, action: 'START', status: 'OK' };
  }

  // LEASE_ALREADY_EXISTS is handled by launchApp → extendLease, so if we get here it's already extended
  // If the error is NO_START_NEEDED (streamlit_wh), skip
  if (result.code === 'NO_START_NEEDED') {
    await updateTriggerStatus(supabase, schedule.id, 'START', 'SKIPPED', 'App is always-on (streamlit_wh)');
    return { scheduleId: schedule.id, appName: schedule.app_name, action: 'START', status: 'SKIPPED', message: 'Always-on app' };
  }

  await updateTriggerStatus(supabase, schedule.id, 'START', 'ERROR', result.error);
  return { scheduleId: schedule.id, appName: schedule.app_name, action: 'START', status: 'ERROR', message: result.error };
}

async function executeStop(
  supabase: SupabaseClient,
  connection: ConnectionRecord,
  schedule: ScheduleRecord,
): Promise<ExecutionResult> {
  // Find active lease for this app
  const { data: leases } = await supabase
    .from('leases')
    .select('*')
    .eq('tenant_id', connection.tenant_id)
    .eq('connection_id', connection.id)
    .eq('app_name', schedule.app_name)
    .eq('status', 'ACTIVE')
    .limit(1);

  if (!leases || leases.length === 0) {
    await updateTriggerStatus(supabase, schedule.id, 'STOP', 'SKIPPED', 'No active lease');
    return { scheduleId: schedule.id, appName: schedule.app_name, action: 'STOP', status: 'SKIPPED', message: 'No active lease' };
  }

  const lease = leases[0];

  const result = await stopLease({
    supabase,
    connection,
    snowflakeLeaseId: lease.snowflake_lease_id,
    localLeaseId: lease.id,
    userId: 'SCHEDULER',
  });

  if (result.ok) {
    await updateTriggerStatus(supabase, schedule.id, 'STOP', 'OK');
    await auditLog(supabase, connection.tenant_id, 'SCHEDULE_STOPPED', 'schedule', schedule.id, 'SCHEDULER', {
      app_name: schedule.app_name,
      schedule_label: schedule.label,
      lease_id: lease.snowflake_lease_id,
    });
    return { scheduleId: schedule.id, appName: schedule.app_name, action: 'STOP', status: 'OK' };
  }

  await updateTriggerStatus(supabase, schedule.id, 'STOP', 'ERROR', result.error);
  return { scheduleId: schedule.id, appName: schedule.app_name, action: 'STOP', status: 'ERROR', message: result.error };
}

// ============================================================
// Helpers
// ============================================================

async function updateTriggerStatus(
  supabase: SupabaseClient,
  scheduleId: string,
  action: string,
  status: string,
  errorMessage?: string,
) {
  await supabase
    .from('app_schedules')
    .update({
      last_triggered_at: new Date().toISOString(),
      last_trigger_action: action,
      last_trigger_status: status,
      last_error: errorMessage ?? null,
    })
    .eq('id', scheduleId);
}

async function auditLog(
  supabase: SupabaseClient,
  tenantId: string,
  action: string,
  targetType: string,
  targetId: string,
  performedBy: string,
  details?: Record<string, unknown>,
) {
  await supabase.from('audit_log').insert({
    tenant_id: tenantId,
    action,
    target_type: targetType,
    target_id: targetId,
    performed_by: performedBy,
    details: details ?? {},
  });
}
