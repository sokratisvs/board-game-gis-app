-- Add event scheduling/details fields for match creation wizard.
ALTER TABLE matches
  ADD COLUMN IF NOT EXISTS end_time TIMESTAMP,
  ADD COLUMN IF NOT EXISTS game_name VARCHAR(120);

CREATE INDEX IF NOT EXISTS idx_matches_end_time ON matches(end_time) WHERE end_time IS NOT NULL;
COMMENT ON COLUMN matches.end_time IS 'Optional scheduled end time for a match';
COMMENT ON COLUMN matches.game_name IS 'Board game title used for this match/event';
