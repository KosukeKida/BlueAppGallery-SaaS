CREATE TABLE public.app_catalog (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    connection_id   UUID NOT NULL REFERENCES public.snowflake_connections(id) ON DELETE CASCADE,
    app_name        TEXT NOT NULL,
    app_version     TEXT,
    app_status      TEXT,
    app_comment     TEXT,
    display_name    TEXT,
    description     TEXT,
    icon_emoji      TEXT DEFAULT '📦',
    icon_color      TEXT DEFAULT 'blue',
    category        TEXT DEFAULT 'general',
    endpoint_url    TEXT,
    compute_pool    TEXT,
    service_name    TEXT,
    postgres_instance TEXT,
    sort_order      INTEGER DEFAULT 0,
    is_visible      BOOLEAN NOT NULL DEFAULT true,
    last_synced_at  TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, app_name)
);

CREATE INDEX idx_catalog_tenant ON public.app_catalog(tenant_id);
CREATE INDEX idx_catalog_infra ON public.app_catalog(tenant_id, compute_pool, postgres_instance);

CREATE TABLE public.leases (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    connection_id       UUID NOT NULL REFERENCES public.snowflake_connections(id) ON DELETE CASCADE,
    snowflake_lease_id  TEXT NOT NULL,
    compute_pool        TEXT,
    app_name            TEXT,
    resources           JSONB NOT NULL DEFAULT '[]',
    status              TEXT NOT NULL DEFAULT 'ACTIVE'
                        CHECK (status IN ('ACTIVE', 'EXPIRED', 'STOPPED', 'ERROR', 'PARTIAL')),
    started_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at          TIMESTAMPTZ NOT NULL,
    initiated_by        UUID REFERENCES auth.users(id),
    last_extended_by    UUID REFERENCES auth.users(id),
    last_extended_at    TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_leases_tenant ON public.leases(tenant_id);
CREATE INDEX idx_leases_active ON public.leases(tenant_id, status) WHERE status = 'ACTIVE';

CREATE TRIGGER set_catalog_updated_at
    BEFORE UPDATE ON public.app_catalog
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_leases_updated_at
    BEFORE UPDATE ON public.leases
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();
