import { SupabaseClient } from '@supabase/supabase-js';

/**
 * Get the active connection for a tenant. Returns the first active connection.
 */
export async function getActiveConnection(supabase: SupabaseClient, tenantId: string) {
  const { data, error } = await supabase
    .from('snowflake_connections')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('is_active', true)
    .order('created_at', { ascending: true })
    .limit(1)
    .single();

  if (error || !data) return null;
  return data;
}

/**
 * Get the tenant_id for the current user.
 */
export async function getTenantId(supabase: SupabaseClient, userId: string): Promise<string | null> {
  const { data } = await supabase
    .from('tenant_members')
    .select('tenant_id')
    .eq('user_id', userId)
    .single();

  return data?.tenant_id ?? null;
}
