-- Returns all tenants the current user belongs to (bypasses RLS)
-- Used by the tenant switcher to show all workspaces
CREATE OR REPLACE FUNCTION public.list_user_tenants()
RETURNS TABLE(tenant_id UUID, tenant_name TEXT, role TEXT)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
    SELECT tm.tenant_id, t.name, tm.role
    FROM public.tenant_members tm
    JOIN public.tenants t ON t.id = tm.tenant_id
    WHERE tm.user_id = auth.uid()
    ORDER BY t.name;
$$;
