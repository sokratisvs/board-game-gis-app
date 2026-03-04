-- AI suggestions + admin approval workflow.
-- When approved → content copied into checkpoints (clue), knowledge_cards, quizzes.
-- Enum/tables idempotent for re-run safe migrations.

DO $$
BEGIN
  CREATE TYPE ai_status AS ENUM ('pending', 'approved', 'rejected');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS ai_suggestions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    checkpoint_id UUID NOT NULL REFERENCES checkpoints(id) ON DELETE CASCADE,
    generated_clue TEXT,
    generated_knowledge_title TEXT,
    generated_knowledge_description TEXT,
    generated_fun_fact TEXT,
    generated_quiz_question TEXT,
    status ai_status NOT NULL DEFAULT 'pending',
    reviewed_by UUID,
    reviewed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Production table for approved knowledge content (filled on approve).
CREATE TABLE IF NOT EXISTS knowledge_cards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    checkpoint_id UUID NOT NULL REFERENCES checkpoints(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    fun_fact TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Optional clue on checkpoint (filled from generated_clue on approve).
ALTER TABLE checkpoints ADD COLUMN IF NOT EXISTS clue TEXT;

CREATE INDEX IF NOT EXISTS idx_ai_suggestions_checkpoint_id ON ai_suggestions(checkpoint_id);
CREATE INDEX IF NOT EXISTS idx_ai_suggestions_status ON ai_suggestions(status);
CREATE INDEX IF NOT EXISTS idx_knowledge_cards_checkpoint_id ON knowledge_cards(checkpoint_id);

COMMENT ON TABLE ai_suggestions IS 'AI-generated content; admin approves or rejects, then content is copied to production';
COMMENT ON COLUMN ai_suggestions.reviewed_by IS 'Admin user id (future FK to users)';
COMMENT ON TABLE knowledge_cards IS 'Production knowledge content per checkpoint (filled from ai_suggestions on approve)';
