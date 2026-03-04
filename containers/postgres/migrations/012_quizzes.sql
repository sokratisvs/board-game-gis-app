-- Quiz system: separate from checkpoints for flexibility (future: multiple quizzes per checkpoint).
-- Supports multiple correct answers later, timed quizzes, randomized options.

CREATE TABLE IF NOT EXISTS quizzes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    checkpoint_id UUID NOT NULL REFERENCES checkpoints(id) ON DELETE CASCADE,
    question TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS quiz_options (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quiz_id UUID NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
    option_text TEXT NOT NULL,
    is_correct BOOLEAN DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_quizzes_checkpoint_id ON quizzes(checkpoint_id);
CREATE INDEX IF NOT EXISTS idx_quiz_options_quiz_id ON quiz_options(quiz_id);

COMMENT ON TABLE quizzes IS 'Quizzes linked to checkpoints; allows multiple quizzes per checkpoint later';
COMMENT ON TABLE quiz_options IS 'Options for a quiz; is_correct allows multiple correct answers';
