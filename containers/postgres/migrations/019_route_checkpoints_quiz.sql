-- Quiz per exploration checkpoint: question + options (with correct answer index).
-- quiz_options: JSON array of { "optionText": string, "isCorrect": boolean }

ALTER TABLE route_checkpoints
  ADD COLUMN IF NOT EXISTS quiz_question TEXT,
  ADD COLUMN IF NOT EXISTS quiz_options JSONB DEFAULT '[]';

COMMENT ON COLUMN route_checkpoints.quiz_options IS 'JSON array of { optionText, isCorrect }; one option has isCorrect true';
