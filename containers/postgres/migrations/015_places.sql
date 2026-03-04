-- Places table with PostGIS geography for radius queries.
-- Requires PostGIS (CREATE EXTENSION IF NOT EXISTS postgis in db.sql).

CREATE TYPE place_category AS ENUM ('museum', 'cafe', 'monument', 'restaurant');

CREATE TABLE places (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    category place_category NOT NULL,
    location GEOGRAPHY(Point, 4326),
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_places_location ON places USING GIST (location);
CREATE INDEX IF NOT EXISTS idx_places_category ON places(category);
CREATE INDEX IF NOT EXISTS idx_places_is_active ON places(is_active) WHERE is_active = TRUE;

COMMENT ON TABLE places IS 'Places with geography; use ST_DWithin(location, ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography, radius_m) for radius queries';
