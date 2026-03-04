-- Checkpoints for routes. Coordinates optional (for fantasy); scene for fantasy.
-- Real route → lat/lng required (enforced in backend).
-- Fantasy route → scene required (enforced in backend).

CREATE TABLE IF NOT EXISTS checkpoints (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    route_id UUID NOT NULL REFERENCES routes(id) ON DELETE CASCADE,
    title TEXT,
    description TEXT,
    order_index INTEGER NOT NULL,
    lat DOUBLE PRECISION,
    lng DOUBLE PRECISION,
    validation_radius_meters INTEGER,
    scene TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_checkpoints_route_id ON checkpoints(route_id);
COMMENT ON TABLE checkpoints IS 'Checkpoints per route: real routes use lat/lng; fantasy routes use scene; validated in backend';
