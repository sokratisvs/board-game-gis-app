-- AI → Admin approval: options, pending_review status, approvedBy/approvedAt.

-- Allow 'pending_review' (new suggestions from AI); keep 'pending' for backward compatibility.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid WHERE t.typname = 'ai_status' AND e.enumlabel = 'pending_review') THEN
    ALTER TYPE ai_status ADD VALUE 'pending_review';
  END IF;
END $$;

-- Store generated quiz options (array of { optionText, isCorrect }) for approve → quiz_options.
ALTER TABLE ai_suggestions
  ADD COLUMN IF NOT EXISTS generated_quiz_options JSONB DEFAULT '[]';

-- Who approved/rejected (username for display).
ALTER TABLE ai_suggestions
  ADD COLUMN IF NOT EXISTS approved_by_username TEXT;

COMMENT ON COLUMN ai_suggestions.generated_quiz_options IS 'JSON array of { optionText, isCorrect } for quiz options on approve';
COMMENT ON COLUMN ai_suggestions.approved_by_username IS 'Username of admin who approved/rejected (e.g. admin_01)';
