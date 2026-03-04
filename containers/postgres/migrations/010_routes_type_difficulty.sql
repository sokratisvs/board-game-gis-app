-- Route metadata: type (real/fantasy), difficulty, city/world, duration.
-- city used for real routes; world used for fantasy routes (only one relevant per type).
-- Enums use DO block so migration is idempotent (re-run safe).

DO $$
BEGIN
    CREATE TYPE route_type AS ENUM ('real', 'fantasy');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    CREATE TYPE route_difficulty AS ENUM ('easy', 'medium', 'hard');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS routes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    city TEXT,
    world TEXT,
    type route_type NOT NULL,
    difficulty route_difficulty NOT NULL,
    estimated_duration_min INTEGER,
    radius_meters INTEGER,
    is_active BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Link existing exploration_routes to route metadata (1:1).
ALTER TABLE exploration_routes
    ADD COLUMN IF NOT EXISTS route_id UUID REFERENCES routes(id) ON DELETE SET NULL;

-- Backfill: create one routes row per exploration_route (only for those without route_id yet).
ALTER TABLE routes ADD COLUMN IF NOT EXISTS _backfill_er_id UUID;
INSERT INTO routes (title, description, type, difficulty, is_active, created_at, updated_at, _backfill_er_id)
SELECT er.name, er.description, 'real'::route_type, 'medium'::route_difficulty, er.is_public, er.created_at, er.updated_at, er.id
FROM exploration_routes er
WHERE er.route_id IS NULL;
UPDATE exploration_routes er SET route_id = r.id FROM routes r WHERE r._backfill_er_id = er.id AND er.route_id IS NULL;
ALTER TABLE routes DROP COLUMN IF EXISTS _backfill_er_id;

CREATE INDEX IF NOT EXISTS idx_exploration_routes_route_id ON exploration_routes(route_id);
COMMENT ON TABLE routes IS 'Route metadata: type (real/fantasy), difficulty, city or world; links to exploration_routes via route_id';
