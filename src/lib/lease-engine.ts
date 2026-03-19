import { SupabaseClient } from '@supabase/supabase-js';
import { SnowflakeSqlApiClient, OperatorApiError } from './snowflake/sql-api-client';
import type {
  OperatorResponse,
  LaunchData,
  ExtendData,
  StopData,
  StatusData,
  HeartbeatData,
} from './snowflake/types';
import { isStatusAll } from './snowflake/types';

// ============================================================
// Connection record from Supabase
// ============================================================

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

/**
 * Create a SnowflakeSqlApiClient from a connection record.
 */
export function createSnowflakeClient(connection: ConnectionRecord): SnowflakeSqlApiClient {
  return new SnowflakeSqlApiClient({
    accountIdentifier: connection.account_identifier,
    accountLocator: connection.account_locator,
    username: connection.username,
    privateKeyPem: connection.encrypted_private_key,
    database: connection.database,
    role: connection.role,
    warehouse: connection.warehouse ?? undefined,
  });
}

// ============================================================
// Launch (new lease)
// ============================================================

/**
 * Launch an app: call api.launch() then record in local DB.
 *
 * If Operator returns LEASE_ALREADY_EXISTS, automatically redirects
 * to extendLease() for seamless UX.
 */
export async function launchApp(params: {
  supabase: SupabaseClient;
  connection: ConnectionRecord;
  appName: string;
  durationMinutes: number;
  userId: string;
  userName?: string;
}): Promise<{ ok: true; data: LaunchData | ExtendData } | { ok: false; error: string; code?: string }> {
  const { supabase, connection, appName, durationMinutes, userId, userName } = params;

  const client = createSnowflakeClient(connection);

  try {
    const response = await client.launchApp(appName, durationMinutes, userName ?? null);

    if (response.status === 'ERROR') {
      const err = response.error;

      // Auto-redirect to extend if lease already exists
      if (err?.code === 'LEASE_ALREADY_EXISTS' && err?.lease_id) {
        return extendLease({
          supabase,
          connection,
          snowflakeLeaseId: err.lease_id,
          durationMinutes,
          userId,
          userName,
        });
      }

      await auditLog(supabase, connection.tenant_id, 'LEASE_LAUNCH_ERROR', 'lease', appName, userId, {
        error_code: err?.code,
        error_message: err?.message,
      });

      return { ok: false, error: err?.message ?? 'Launch failed', code: err?.code };
    }

    const data = response.data!;

    // Insert lease in local DB
    await supabase.from('leases').insert({
      tenant_id: connection.tenant_id,
      connection_id: connection.id,
      snowflake_lease_id: data.lease_id,
      compute_pool: data.compute_pool,
      app_name: data.app_name,
      resources: data.resources,
      status: 'ACTIVE',
      expires_at: data.expires_at,
      initiated_by: userId,
    });

    await auditLog(supabase, connection.tenant_id, 'LEASE_STARTED', 'lease', data.lease_id, userId, {
      app_name: data.app_name,
      compute_pool: data.compute_pool,
      resources: data.resources,
      expires_at: data.expires_at,
      duration_minutes: durationMinutes,
      service_warning: data.service_warning,
    });

    return { ok: true, data };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await auditLog(supabase, connection.tenant_id, 'LEASE_LAUNCH_ERROR', 'lease', appName, userId, {
      error: message,
    });
    return { ok: false, error: message };
  }
}

// ============================================================
// Extend (existing lease)
// ============================================================

/**
 * Extend a lease: call api.extend() then update local DB.
 */
export async function extendLease(params: {
  supabase: SupabaseClient;
  connection: ConnectionRecord;
  snowflakeLeaseId: string;
  durationMinutes: number;
  userId: string;
  userName?: string;
}): Promise<{ ok: true; data: ExtendData } | { ok: false; error: string; code?: string }> {
  const { supabase, connection, snowflakeLeaseId, durationMinutes, userId, userName } = params;
  const client = createSnowflakeClient(connection);

  try {
    const response = await client.extendLease(snowflakeLeaseId, durationMinutes, userName ?? null);

    if (response.status === 'ERROR') {
      const err = response.error;
      await auditLog(supabase, connection.tenant_id, 'LEASE_EXTEND_ERROR', 'lease', snowflakeLeaseId, userId, {
        error_code: err?.code,
        error_message: err?.message,
      });
      return { ok: false, error: err?.message ?? 'Extend failed', code: err?.code };
    }

    const data = response.data!;

    // Update local DB
    await supabase
      .from('leases')
      .update({
        status: 'ACTIVE',
        expires_at: data.expires_at,
        resources: data.resources,
        last_extended_by: userId,
        last_extended_at: new Date().toISOString(),
      })
      .eq('snowflake_lease_id', snowflakeLeaseId)
      .eq('tenant_id', connection.tenant_id);

    await auditLog(supabase, connection.tenant_id, 'LEASE_EXTENDED', 'lease', data.lease_id, userId, {
      app_name: data.app_name,
      compute_pool: data.compute_pool,
      expires_at: data.expires_at,
      duration_minutes: durationMinutes,
    });

    return { ok: true, data };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, error: message };
  }
}

// ============================================================
// Stop
// ============================================================

/**
 * Stop a lease: call api.stop() then update local DB.
 */
export async function stopLease(params: {
  supabase: SupabaseClient;
  connection: ConnectionRecord;
  snowflakeLeaseId: string;
  localLeaseId: string;
  userId: string;
}): Promise<{ ok: true; data: StopData } | { ok: false; error: string }> {
  const { supabase, connection, snowflakeLeaseId, localLeaseId, userId } = params;
  const client = createSnowflakeClient(connection);

  try {
    const response = await client.stopLease(snowflakeLeaseId);

    const newStatus = response.status === 'OK' ? 'STOPPED' : 'ERROR';

    // Update local DB
    await supabase
      .from('leases')
      .update({ status: newStatus })
      .eq('id', localLeaseId);

    // Deactivate heartbeats
    await supabase
      .from('heartbeats')
      .update({ is_active: false })
      .eq('lease_id', localLeaseId);

    if (response.status === 'ERROR') {
      await auditLog(supabase, connection.tenant_id, 'LEASE_STOP_ERROR', 'lease', snowflakeLeaseId, userId, {
        error_code: response.error?.code,
        error_message: response.error?.message,
      });
      return { ok: false, error: response.error?.message ?? 'Stop failed' };
    }

    await auditLog(supabase, connection.tenant_id, 'LEASE_STOPPED', 'lease', snowflakeLeaseId, userId, {
      app_name: response.data!.app_name,
      compute_pool: response.data!.compute_pool,
    });

    return { ok: true, data: response.data! };
  } catch (error) {
    // Mark as ERROR even on exception
    await supabase
      .from('leases')
      .update({ status: 'ERROR' })
      .eq('id', localLeaseId);

    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, error: message };
  }
}

// ============================================================
// Refresh statuses (detect Watchdog auto-stops)
// ============================================================

/**
 * Refresh lease statuses from Snowflake and sync local DB.
 * Returns leases that were detected as expired/stopped by Watchdog.
 */
export async function refreshLeaseStatuses(params: {
  supabase: SupabaseClient;
  connection: ConnectionRecord;
  tenantId: string;
}) {
  const { supabase, connection, tenantId } = params;
  const client = createSnowflakeClient(connection);

  // Get all active leases from local DB
  const { data: activeLeases } = await supabase
    .from('leases')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('connection_id', connection.id)
    .eq('status', 'ACTIVE');

  if (!activeLeases || activeLeases.length === 0) return [];

  // Get all active leases from Snowflake
  const response = await client.getStatus(null);

  if (response.status === 'ERROR') return [];

  // Build set of active Snowflake lease IDs
  const snowflakeActiveIds = new Set<string>();
  const statusData = response.data!;

  if (isStatusAll(statusData)) {
    for (const lease of statusData.active_leases) {
      snowflakeActiveIds.add(lease.lease_id);
    }
  }

  // Mark locally-active leases that Snowflake no longer knows about
  const expiredLeases = [];
  for (const lease of activeLeases) {
    if (!snowflakeActiveIds.has(lease.snowflake_lease_id)) {
      await supabase
        .from('leases')
        .update({ status: 'EXPIRED' })
        .eq('id', lease.id);

      await supabase
        .from('heartbeats')
        .update({ is_active: false })
        .eq('lease_id', lease.id);

      await auditLog(supabase, tenantId, 'LEASE_EXPIRED_SYNC', 'lease', lease.snowflake_lease_id, 'system', {
        detected_by: 'refresh_status',
      });

      expiredLeases.push(lease);
    }
  }

  return expiredLeases;
}

// ============================================================
// Heartbeat
// ============================================================

/**
 * Record a heartbeat: call api.heartbeat() then record in local DB.
 */
export async function recordHeartbeat(params: {
  supabase: SupabaseClient;
  connection: ConnectionRecord;
  snowflakeLeaseId: string;
  localLeaseId: string;
  userId: string;
  userName?: string;
  sessionId?: string;
}): Promise<OperatorResponse<HeartbeatData>> {
  const { supabase, connection, snowflakeLeaseId, localLeaseId, userId, userName, sessionId } = params;
  const client = createSnowflakeClient(connection);

  const response = await client.heartbeat(snowflakeLeaseId, userName ?? null);

  if (response.status === 'OK') {
    await supabase.from('heartbeats').insert({
      tenant_id: connection.tenant_id,
      lease_id: localLeaseId,
      user_id: userId,
      session_id: sessionId ?? null,
      is_active: true,
    });
  }

  return response;
}

// ============================================================
// Helpers
// ============================================================

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
