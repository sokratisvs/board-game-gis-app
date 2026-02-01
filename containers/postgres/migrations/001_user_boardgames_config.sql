-- Board games configuration per user (dashboard: games owned/liked, types, space, city, subscription)
-- On staging/production: runs automatically via the migrate service in docker-compose (containers/docker-compose.yml).

DO $$ BEGIN
  CREATE TYPE subscription_tier AS ENUM ('free', 'extra');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS user_boardgames_config (
  user_id INT PRIMARY KEY REFERENCES users(user_id) ON DELETE CASCADE,
  games_owned JSONB NOT NULL DEFAULT '[]',
  games_liked JSONB NOT NULL DEFAULT '[]',
  game_types_interested JSONB NOT NULL DEFAULT '[]',
  has_space BOOLEAN NOT NULL DEFAULT false,
  city VARCHAR(120),
  subscription subscription_tier NOT NULL DEFAULT 'free',
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_user_boardgames_config_city ON user_boardgames_config(city) WHERE city IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_user_boardgames_config_subscription ON user_boardgames_config(subscription);
COMMENT ON TABLE user_boardgames_config IS 'Per-user board games preferences and subscription; used by admin dashboard';
