-- Exploration routes: Answer → Clue → Context → Discovery (quiz trails with pinned points)
-- Routes have ordered checkpoints; each checkpoint has clue, image, knowledge card, XP, and linked recommendations.

CREATE TABLE IF NOT EXISTS exploration_routes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(200) NOT NULL,
  description TEXT,
  created_by INT REFERENCES users(user_id) ON DELETE SET NULL,
  is_public BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS route_checkpoints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id UUID NOT NULL REFERENCES exploration_routes(id) ON DELETE CASCADE,
  sequence_order INT NOT NULL,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  clue_text TEXT NOT NULL,
  image_url TEXT,
  knowledge_card JSONB,
  xp_awarded INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (route_id, sequence_order)
);

CREATE TABLE IF NOT EXISTS recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type VARCHAR(50) NOT NULL,
  name VARCHAR(200),
  external_id VARCHAR(100),
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  description TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS route_checkpoint_recommendations (
  checkpoint_id UUID NOT NULL REFERENCES route_checkpoints(id) ON DELETE CASCADE,
  recommendation_id UUID NOT NULL REFERENCES recommendations(id) ON DELETE CASCADE,
  PRIMARY KEY (checkpoint_id, recommendation_id)
);

CREATE INDEX IF NOT EXISTS idx_route_checkpoints_route_id ON route_checkpoints(route_id);
CREATE INDEX IF NOT EXISTS idx_recommendations_type ON recommendations(type);
CREATE INDEX IF NOT EXISTS idx_route_checkpoint_recommendations_checkpoint ON route_checkpoint_recommendations(checkpoint_id);

COMMENT ON TABLE exploration_routes IS 'Quiz/exploration trails: ordered pins with clues and rewards';
COMMENT ON COLUMN route_checkpoints.knowledge_card IS 'JSON: { title, description, funFact }';
COMMENT ON COLUMN recommendations.external_id IS 'External reference e.g. benaki_01 for nearbyRecommendations';
