-- Matches and match_players for mobile event session (REST + future WebSocket).
CREATE TABLE IF NOT EXISTS matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  zone_name VARCHAR(200) NOT NULL DEFAULT '',
  zone_lat DOUBLE PRECISION,
  zone_lng DOUBLE PRECISION,
  current_turn_user_id INT REFERENCES users(user_id),
  unread_chat_count INT NOT NULL DEFAULT 0,
  last_dice_values JSONB NOT NULL DEFAULT '[]',
  grid_rows INT,
  grid_cols INT,
  highlighted_row INT,
  highlighted_col INT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS match_players (
  match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  user_id INT NOT NULL REFERENCES users(user_id),
  display_name VARCHAR(120) NOT NULL,
  health_percent INT NOT NULL DEFAULT 100,
  mana_current INT NOT NULL DEFAULT 0,
  mana_max INT NOT NULL DEFAULT 100,
  "order" INT NOT NULL DEFAULT 0,
  is_current_turn BOOLEAN NOT NULL DEFAULT false,
  PRIMARY KEY (match_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_match_players_match_id ON match_players(match_id);
COMMENT ON TABLE matches IS 'Live match/session for mobile app; state for REST and WebSocket';
