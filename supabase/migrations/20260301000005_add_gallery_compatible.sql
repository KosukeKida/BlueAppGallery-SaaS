-- v0.6.0: Add gallery_compatible column to app_catalog
-- Gallery-compatible apps allow explicit SERVICE lifecycle control by Gallery Operator.
ALTER TABLE public.app_catalog
    ADD COLUMN IF NOT EXISTS gallery_compatible BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.app_catalog.gallery_compatible IS
    'When true, Gallery Operator can explicitly RESUME/SUSPEND the SERVICE via managed_resources.';
