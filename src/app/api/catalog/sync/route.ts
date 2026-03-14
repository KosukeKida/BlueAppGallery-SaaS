import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getTenantId, getActiveConnection } from '@/lib/get-connection';
import { createSnowflakeClient } from '@/lib/lease-engine';

export const maxDuration = 60;

// POST /api/catalog/sync - Sync managed apps from Snowflake Operator to Supabase
export async function POST() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const tenantId = await getTenantId(supabase, user.id);
  if (!tenantId) return NextResponse.json({ error: 'No tenant found' }, { status: 404 });

  const connection = await getActiveConnection(supabase, tenantId);
  if (!connection) {
    return NextResponse.json({ error: 'No active Snowflake connection' }, { status: 404 });
  }

  if (!connection.encrypted_private_key) {
    return NextResponse.json({ error: 'Private key not configured' }, { status: 400 });
  }

  const client = createSnowflakeClient(connection);

  try {
    // Call api.list_apps() — the single source of truth
    const response = await client.listApps();

    if (response.status === 'ERROR') {
      return NextResponse.json(
        { error: response.error?.message ?? 'Failed to list apps' },
        { status: 502 }
      );
    }

    const apps = response.data?.apps ?? [];

    if (apps.length === 0) {
      return NextResponse.json({
        ok: true,
        synced: 0,
        message: 'No managed apps found. Register apps in the Operator Streamlit dashboard first.',
      });
    }

    // Upsert each app into Supabase, preserving display fields
    let synced = 0;
    const errors: string[] = [];
    for (const app of apps) {
      // Check if app already exists to preserve display customizations
      const { data: existing } = await supabase
        .from('app_catalog')
        .select('display_name, icon_emoji, sort_order, endpoint_url, category')
        .eq('tenant_id', tenantId)
        .eq('app_name', app.app_name)
        .single();

      // Snowflake catalog value > existing Supabase value
      // Live endpoint resolution happens at launch/open time, not during sync
      const endpointUrl = app.endpoint_url || existing?.endpoint_url || null;

      // Filter out default Snowflake CLI comment
      const appComment = (app.app_comment ?? '').toUpperCase() === 'GENERATED_BY_SNOWFLAKECLI'
        ? null
        : app.app_comment;

      const { error } = await supabase
        .from('app_catalog')
        .upsert(
          {
            tenant_id: tenantId,
            connection_id: connection.id,
            app_name: app.app_name,
            app_comment: appComment,
            app_type: app.app_type,
            compute_pool: app.compute_pool,
            service_name: app.service_name,
            endpoint_url: endpointUrl,
            gallery_compatible: app.gallery_compatible ?? false,
            // Preserve existing display customizations
            display_name: existing?.display_name ?? app.app_name,
            icon_emoji: existing?.icon_emoji ?? '📦',
            category: existing?.category ?? null,
            sort_order: existing?.sort_order ?? 0,
            is_visible: true,
            last_synced_at: new Date().toISOString(),
          },
          { onConflict: 'tenant_id,app_name' }
        );

      if (error) {
        console.error(`[catalog/sync] Upsert failed for ${app.app_name}:`, error.message);
        errors.push(`${app.app_name}: ${error.message}`);
      } else {
        synced++;
      }
    }

    return NextResponse.json({
      ok: true,
      synced,
      total: apps.length,
      ...(errors.length > 0 && { errors }),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 502 }
    );
  }
}
