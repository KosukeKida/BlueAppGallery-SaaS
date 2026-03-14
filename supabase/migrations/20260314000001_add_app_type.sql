-- Add app_type column to app_catalog
-- Values: 'native_app', 'streamlit_cp', 'streamlit_wh'
ALTER TABLE public.app_catalog
    ADD COLUMN IF NOT EXISTS app_type TEXT DEFAULT 'native_app';

COMMENT ON COLUMN public.app_catalog.app_type IS
    'Application type: native_app, streamlit_cp (compute pool), or streamlit_wh (warehouse)';
