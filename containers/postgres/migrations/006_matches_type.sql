-- Add match_type for admin filtering (tournament, casual, campaign, other).
ALTER TABLE matches
  ADD COLUMN IF NOT EXISTS match_type VARCHAR(50) DEFAULT 'other';

CREATE INDEX IF NOT EXISTS idx_matches_match_type ON matches(match_type) WHERE match_type IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_matches_zone_position ON matches(zone_lat, zone_lng) WHERE zone_lat IS NOT NULL AND zone_lng IS NOT NULL;
COMMENT ON COLUMN matches.match_type IS 'Admin filter: tournament, casual, campaign, other';
