CREATE TABLE public.snowflake_connections (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    display_name        TEXT NOT NULL DEFAULT 'Default',
    account_identifier  TEXT NOT NULL,
    account_locator     TEXT,
    username            TEXT NOT NULL,
    encrypted_private_key TEXT,
    warehouse           TEXT,
    role                TEXT DEFAULT 'gallery_saas_role',
    database            TEXT DEFAULT 'APP_GALLERY_OPERATOR',
    schema_name         TEXT DEFAULT 'core',
    is_active           BOOLEAN NOT NULL DEFAULT true,
    last_tested_at      TIMESTAMPTZ,
    last_test_result    TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_connections_tenant ON public.snowflake_connections(tenant_id);

CREATE TRIGGER set_connections_updated_at
    BEFORE UPDATE ON public.snowflake_connections
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();
