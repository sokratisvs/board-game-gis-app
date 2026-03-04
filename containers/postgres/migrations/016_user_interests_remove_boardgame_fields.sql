-- Users: add interests for future route/quiz personalization.
-- Remove board-game–specific fields from user_boardgames_config (games owned, liked, types, has_space).

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS interests JSONB NOT NULL DEFAULT '[]';

COMMENT ON COLUMN users.interests IS 'User interests (e.g. history, coffee, architecture) for future route/quiz personalization';

ALTER TABLE user_boardgames_config
  DROP COLUMN IF EXISTS games_owned,
  DROP COLUMN IF EXISTS games_liked,
  DROP COLUMN IF EXISTS game_types_interested,
  DROP COLUMN IF EXISTS has_space;

COMMENT ON TABLE user_boardgames_config IS 'User profile/config: city, subscription, display; board-game fields removed in favor of users.interests';

-- Optional: seed example interests for existing seed user
UPDATE users SET interests = '["history", "architecture", "coffee"]'::jsonb WHERE email = 'sok_gr3@yahoo.gr' AND interests = '[]'::jsonb;
