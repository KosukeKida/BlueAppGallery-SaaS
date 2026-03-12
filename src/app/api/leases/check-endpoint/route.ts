import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getTenantId, getActiveConnection } from '@/lib/get-connection';
import { createSnowflakeClient } from '@/lib/lease-engine';
import { isEndpointReady } from '@/lib/snowflake/types';

export const maxDuration = 60;

// POST /api/leases/check-endpoint - Check if an app's endpoint is ready
// Uses api.get_endpoints() for automatic URL discovery.
// Falls back to HTTP check if endpoint_url is already known.
export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const tenantId = await getTenantId(supabase, user.id);
  if (!tenantId) return NextResponse.json({ error: 'No tenant found' }, { status: 404 });

  const { appName, endpointUrl } = await request.json();

  // Strategy 1: If we already have an endpoint URL, do a quick HTTP check
  if (endpointUrl) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      const res = await fetch(endpointUrl, {
        method: 'GET',
        signal: controller.signal,
        redirect: 'follow',
        headers: { 'User-Agent': 'AppGallery-EndpointCheck/1.0' },
      });
      clearTimeout(timeout);
      return NextResponse.json({
        ready: true,
        ingress_url: endpointUrl,
        httpStatus: res.status,
        source: 'http_check',
      });
    } catch {
      if (!appName) {
        return NextResponse.json({ ready: false, reason: 'not_accessible' });
      }
    }
  }

  // Strategy 2: Use api.get_endpoints() for discovery
  if (!appName) {
    return NextResponse.json({ ready: false, reason: 'no_app_name' });
  }

  const connection = await getActiveConnection(supabase, tenantId);
  if (!connection || !connection.encrypted_private_key) {
    return NextResponse.json({ ready: false, reason: 'no_connection' });
  }

  const client = createSnowflakeClient(connection);

  try {
    const response = await client.getEndpoints(appName);

    if (response.status === 'ERROR') {
      return NextResponse.json({
        ready: false,
        reason: response.error?.message ?? 'endpoint_error',
      });
    }

    const data = response.data!;

    if (isEndpointReady(data)) {
      // Auto-save endpoint_url to Supabase app_catalog
      const ingressUrl = data.ingress_url.startsWith('http')
        ? data.ingress_url
        : `https://${data.ingress_url}`;

      await supabase
        .from('app_catalog')
        .update({ endpoint_url: ingressUrl })
        .eq('tenant_id', tenantId)
        .eq('app_name', appName);

      return NextResponse.json({
        ready: true,
        ingress_url: ingressUrl,
        endpoints: data.endpoints,
        source: 'snowflake',
      });
    }

    // Not ready yet
    return NextResponse.json({
      ready: false,
      status: data.endpoint_status,
      reason: data.message || 'endpoint_not_ready',
      service_name: data.service_name,
    });
  } catch (error) {
    return NextResponse.json({
      ready: false,
      reason: 'snowflake_error',
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
