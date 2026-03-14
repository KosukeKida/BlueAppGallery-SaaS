-- Promotion cards: ads, donations, and sponsored content shown in the Gallery grid
CREATE TABLE public.promotion_cards (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    title           TEXT NOT NULL,
    description     TEXT,
    image_url       TEXT,
    link_url        TEXT NOT NULL,
    position        INTEGER NOT NULL DEFAULT 0,
    is_active       BOOLEAN NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_promotion_cards_tenant ON public.promotion_cards(tenant_id);

ALTER TABLE public.promotion_cards ENABLE ROW LEVEL SECURITY;

CREATE POLICY promotion_cards_select ON public.promotion_cards
    FOR SELECT USING (tenant_id = public.current_tenant_id());
CREATE POLICY promotion_cards_all ON public.promotion_cards
    FOR ALL USING (tenant_id = public.current_tenant_id());
