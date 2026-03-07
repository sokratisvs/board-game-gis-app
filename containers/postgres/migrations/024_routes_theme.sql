-- Route theme/category for urban exploration: history, literature, sports, culture.
-- Affects map symbols and user filtering (e.g. "show history routes").
DO $$
BEGIN
    CREATE TYPE route_theme AS ENUM ('history', 'literature', 'sports', 'culture');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE routes
    ADD COLUMN IF NOT EXISTS theme route_theme;

-- Backfill existing rows so theme is set (default history for urban/cultural routes).
UPDATE routes SET theme = 'history'::route_theme WHERE theme IS NULL;

-- Default for new rows.
ALTER TABLE routes
    ALTER COLUMN theme SET DEFAULT 'history'::route_theme;

COMMENT ON COLUMN routes.theme IS 'Content theme for map symbols and filtering: history, literature, sports, culture';
