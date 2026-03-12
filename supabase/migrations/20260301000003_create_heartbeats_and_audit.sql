CREATE TABLE public.heartbeats (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    lease_id    UUID NOT NULL REFERENCES public.leases(id) ON DELETE CASCADE,
    user_id     UUID NOT NULL REFERENCES auth.users(id),
    session_id  TEXT,
    is_active   BOOLEAN NOT NULL DEFAULT true,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_heartbeats_lease ON public.heartbeats(lease_id);
CREATE INDEX idx_heartbeats_active ON public.heartbeats(lease_id, is_active) WHERE is_active = true;

CREATE TABLE public.audit_log (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    action          TEXT NOT NULL,
    target_type     TEXT,
    target_id       TEXT,
    performed_by    UUID REFERENCES auth.users(id),
    details         JSONB,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_tenant ON public.audit_log(tenant_id);
CREATE INDEX idx_audit_created ON public.audit_log(tenant_id, created_at DESC);
