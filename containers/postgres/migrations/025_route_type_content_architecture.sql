-- Add architecture to route theme enum (content type for map/filtering).
-- API exposes this as "type" (history, literature, culture, architecture, sports).
DO $$
BEGIN
    ALTER TYPE route_theme ADD VALUE 'architecture';
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

COMMENT ON COLUMN routes.theme IS 'Content type for map symbols and filtering: history, literature, culture, architecture, sports (exposed as "type" in API)';
