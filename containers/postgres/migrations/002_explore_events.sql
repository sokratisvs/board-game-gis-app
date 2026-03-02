-- Explore/map events for mobile app (GET /api/explore). PostGIS for nearby query.
CREATE TABLE IF NOT EXISTS explore_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(200) NOT NULL,
  subtitle VARCHAR(200),
  position geometry(Point, 4326) NOT NULL,
  image_uri TEXT,
  reward_label VARCHAR(100),
  is_active BOOLEAN NOT NULL DEFAULT true,
  type VARCHAR(50) DEFAULT 'other'
);

CREATE INDEX IF NOT EXISTS idx_explore_events_position ON explore_events USING GIST (position);
COMMENT ON TABLE explore_events IS 'Map events for mobile explore (mana_well, challenge, venue, etc.)';
