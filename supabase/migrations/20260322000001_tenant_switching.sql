-- Tenant switching support: read active_tenant_id from JWT app_metadata
-- This allows users who belong to multiple tenants to switch between them
-- without re-login. The app_metadata is updated via Supabase admin API
-- and the client refreshes the session to get the new JWT.

-- Replace current_tenant_id to support explicit tenant selection via JWT
CREATE OR REPLACE FUNCTION public.current_tenant_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
    SELECT COALESCE(
        -- Priority 1: explicitly set tenant from JWT app_metadata
        (auth.jwt() -> 'app_metadata' ->> 'active_tenant_id')::uuid,
        -- Priority 2: fallback to first membership (backward compat / initial login)
        (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid() LIMIT 1)
    );
$$;
