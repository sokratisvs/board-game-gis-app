-- Unlock content for play flow: clue, knowledge card, XP (real and fantasy).
-- knowledge_card JSON: { title, description, funFact }

ALTER TABLE checkpoints
  ADD COLUMN IF NOT EXISTS clue TEXT,
  ADD COLUMN IF NOT EXISTS knowledge_card JSONB,
  ADD COLUMN IF NOT EXISTS xp_awarded INTEGER NOT NULL DEFAULT 0;

COMMENT ON COLUMN checkpoints.knowledge_card IS 'JSON: { title, description, funFact } for correct-answer unlock';
