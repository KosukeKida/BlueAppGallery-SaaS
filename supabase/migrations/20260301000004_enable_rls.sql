ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.snowflake_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.heartbeats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenants_select ON public.tenants
    FOR SELECT USING (id = public.current_tenant_id());

CREATE POLICY tenants_update ON public.tenants
    FOR UPDATE USING (
        id = public.current_tenant_id()
        AND EXISTS (
            SELECT 1 FROM public.tenant_members
            WHERE tenant_id = tenants.id AND user_id = auth.uid() AND role IN ('owner', 'admin')
        )
    );

CREATE POLICY members_select ON public.tenant_members
    FOR SELECT USING (tenant_id = public.current_tenant_id());

CREATE POLICY members_insert ON public.tenant_members
    FOR INSERT WITH CHECK (
        tenant_id = public.current_tenant_id()
        AND EXISTS (
            SELECT 1 FROM public.tenant_members tm
            WHERE tm.tenant_id = tenant_members.tenant_id AND tm.user_id = auth.uid() AND tm.role IN ('owner', 'admin')
        )
    );

CREATE POLICY connections_select ON public.snowflake_connections
    FOR SELECT USING (tenant_id = public.current_tenant_id());
CREATE POLICY connections_insert ON public.snowflake_connections
    FOR INSERT WITH CHECK (tenant_id = public.current_tenant_id());
CREATE POLICY connections_update ON public.snowflake_connections
    FOR UPDATE USING (tenant_id = public.current_tenant_id());
CREATE POLICY connections_delete ON public.snowflake_connections
    FOR DELETE USING (tenant_id = public.current_tenant_id());

CREATE POLICY catalog_select ON public.app_catalog
    FOR SELECT USING (tenant_id = public.current_tenant_id());
CREATE POLICY catalog_all ON public.app_catalog
    FOR ALL USING (tenant_id = public.current_tenant_id());

CREATE POLICY leases_select ON public.leases
    FOR SELECT USING (tenant_id = public.current_tenant_id());
CREATE POLICY leases_all ON public.leases
    FOR ALL USING (tenant_id = public.current_tenant_id());

CREATE POLICY heartbeats_select ON public.heartbeats
    FOR SELECT USING (tenant_id = public.current_tenant_id());
CREATE POLICY heartbeats_insert ON public.heartbeats
    FOR INSERT WITH CHECK (tenant_id = public.current_tenant_id());

CREATE POLICY audit_select ON public.audit_log
    FOR SELECT USING (tenant_id = public.current_tenant_id());
CREATE POLICY audit_insert ON public.audit_log
    FOR INSERT WITH CHECK (tenant_id = public.current_tenant_id());
