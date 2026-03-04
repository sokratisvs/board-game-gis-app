-- Add optional match start time for scheduling.
ALTER TABLE matches
  ADD COLUMN IF NOT EXISTS start_time TIMESTAMP;

CREATE INDEX IF NOT EXISTS idx_matches_start_time ON matches(start_time) WHERE start_time IS NOT NULL;
COMMENT ON COLUMN matches.start_time IS 'Optional scheduled start time for a match';
