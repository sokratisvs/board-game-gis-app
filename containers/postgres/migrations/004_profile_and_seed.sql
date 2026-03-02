-- Profile display and stats on config; seed user sok_gr3@yahoo.gr and explore events.
-- Run after 001, 002 (explore_events must exist).

-- Profile fields on user_boardgames_config (optional; used by GET /api/profile)
ALTER TABLE user_boardgames_config
  ADD COLUMN IF NOT EXISTS display_name VARCHAR(120),
  ADD COLUMN IF NOT EXISTS subtitle VARCHAR(200),
  ADD COLUMN IF NOT EXISTS avatar_uri TEXT,
  ADD COLUMN IF NOT EXISTS level INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS play_style_tier VARCHAR(50),
  ADD COLUMN IF NOT EXISTS matches_count INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS wins_count INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS titles_count INT NOT NULL DEFAULT 0;

-- Recent battlefields per user (for ProfileData.recentBattlefields)
CREATE TABLE IF NOT EXISTS user_recent_battlefields (
  user_id INT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  id VARCHAR(50) NOT NULL,
  name VARCHAR(200) NOT NULL,
  image_uri TEXT,
  last_match_at VARCHAR(50) NOT NULL,
  xp_delta INT NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, id)
);

-- Seed user sok_gr3@yahoo.gr (password same as other mocks: password123)
INSERT INTO users (username, password, email, created_on, type)
SELECT 'sok_gr3', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'sok_gr3@yahoo.gr', NOW(), 'user'
WHERE NOT EXISTS (SELECT 1 FROM users WHERE email = 'sok_gr3@yahoo.gr');

-- Config + profile for sok_gr3@yahoo.gr
INSERT INTO user_boardgames_config (
  user_id, games_owned, games_liked, game_types_interested,
  has_space, city, subscription,
  display_name, subtitle, level, play_style_tier, matches_count, wins_count, titles_count
)
SELECT u.user_id,
  '["Catan", "Ticket to Ride", "Carcassonne", "Wingspan", "Terraforming Mars"]'::jsonb,
  '["Catan", "Wingspan", "7 Wonders"]'::jsonb,
  '["Strategy", "Eurogames", "Worker Placement", "Tile Laying"]'::jsonb,
  true, 'Athens', 'extra',
  'Sokratis', 'Grandmaster Rank • Season 5', 42, 'Pro', 127, 89, 3
FROM users u WHERE u.email = 'sok_gr3@yahoo.gr'
ON CONFLICT (user_id) DO UPDATE SET
  games_owned = EXCLUDED.games_owned,
  games_liked = EXCLUDED.games_liked,
  game_types_interested = EXCLUDED.game_types_interested,
  has_space = EXCLUDED.has_space,
  city = EXCLUDED.city,
  subscription = EXCLUDED.subscription,
  display_name = EXCLUDED.display_name,
  subtitle = EXCLUDED.subtitle,
  level = EXCLUDED.level,
  play_style_tier = EXCLUDED.play_style_tier,
  matches_count = EXCLUDED.matches_count,
  wins_count = EXCLUDED.wins_count,
  titles_count = EXCLUDED.titles_count,
  updated_at = CURRENT_TIMESTAMP;

-- Recent battlefields for sok_gr3
INSERT INTO user_recent_battlefields (user_id, id, name, image_uri, last_match_at, xp_delta)
SELECT u.user_id, 'bf1', 'Acropolis Arena', NULL, '2 days ago', 12 FROM users u WHERE u.email = 'sok_gr3@yahoo.gr'
ON CONFLICT (user_id, id) DO NOTHING;
INSERT INTO user_recent_battlefields (user_id, id, name, image_uri, last_match_at, xp_delta)
SELECT u.user_id, 'bf2', 'Port of Piraeus', NULL, '1 week ago', -4 FROM users u WHERE u.email = 'sok_gr3@yahoo.gr'
ON CONFLICT (user_id, id) DO NOTHING;

-- Explore events (Athens area); skip if already seeded to avoid duplicates
INSERT INTO explore_events (title, subtitle, position, type, reward_label, is_active)
SELECT 'Mana Well Alpha', 'Central Athens', ST_SetSRID(ST_MakePoint(23.7348, 37.9755), 4326), 'mana_well', '+10 XP', true
WHERE NOT EXISTS (SELECT 1 FROM explore_events WHERE title = 'Mana Well Alpha' LIMIT 1);
INSERT INTO explore_events (title, subtitle, position, type, reward_label, is_active)
SELECT 'Strategy Challenge', 'Syntagma', ST_SetSRID(ST_MakePoint(23.7357, 37.9753), 4326), 'challenge', 'Badge', true
WHERE NOT EXISTS (SELECT 1 FROM explore_events WHERE title = 'Strategy Challenge' LIMIT 1);
INSERT INTO explore_events (title, subtitle, position, type, reward_label, is_active)
SELECT 'Board Game Cafe', 'Venue', ST_SetSRID(ST_MakePoint(23.7145, 37.9421), 4326), 'venue', 'Meetup', true
WHERE NOT EXISTS (SELECT 1 FROM explore_events WHERE title = 'Board Game Cafe' LIMIT 1);
INSERT INTO explore_events (title, subtitle, position, type, reward_label, is_active)
SELECT 'Weekend Tournament', 'Piraeus', ST_SetSRID(ST_MakePoint(23.6469, 37.9439), 4326), 'venue', NULL, true
WHERE NOT EXISTS (SELECT 1 FROM explore_events WHERE title = 'Weekend Tournament' LIMIT 1);
INSERT INTO explore_events (title, subtitle, position, type, reward_label, is_active)
SELECT 'Hidden Well', 'Lykavittos', ST_SetSRID(ST_MakePoint(23.7433, 37.9819), 4326), 'mana_well', NULL, false
WHERE NOT EXISTS (SELECT 1 FROM explore_events WHERE title = 'Hidden Well' LIMIT 1);

-- Optional: set location for sok_gr3 so /api/location/:id and map work
INSERT INTO location (user_id, coordinates)
SELECT u.user_id, ST_SetSRID(ST_MakePoint(23.7348, 37.9755), 4326)
FROM users u WHERE u.email = 'sok_gr3@yahoo.gr'
ON CONFLICT (user_id) DO UPDATE SET coordinates = EXCLUDED.coordinates;
