-- App schedules: automated start/stop times for apps (organization-admin feature)
CREATE TABLE public.app_schedules (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    connection_id       UUID NOT NULL REFERENCES public.snowflake_connections(id) ON DELETE CASCADE,
    app_name            TEXT NOT NULL,
    label               TEXT,
    days_of_week        INTEGER[] NOT NULL,       -- ISO 8601: 1=Mon, 7=Sun
    start_time          TIME NOT NULL,
    stop_time           TIME NOT NULL,
    timezone            TEXT NOT NULL DEFAULT 'Asia/Tokyo',
    is_enabled          BOOLEAN NOT NULL DEFAULT true,
    last_triggered_at   TIMESTAMPTZ,
    last_trigger_action TEXT,                      -- 'START' | 'STOP' | null
    last_trigger_status TEXT,                      -- 'OK' | 'ERROR' | 'SKIPPED' | null
    last_error          TEXT,
    created_by          UUID REFERENCES auth.users(id),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_schedules_tenant ON public.app_schedules(tenant_id);
CREATE INDEX idx_schedules_enabled ON public.app_schedules(tenant_id, is_enabled) WHERE is_enabled = true;

ALTER TABLE public.app_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY schedules_select ON public.app_schedules
    FOR SELECT USING (tenant_id = public.current_tenant_id());
CREATE POLICY schedules_all ON public.app_schedules
    FOR ALL USING (tenant_id = public.current_tenant_id());
