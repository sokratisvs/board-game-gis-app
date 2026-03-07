-- Track which checkpoints a user has completed (solved) per route.
-- Used to show "solved" icon and reveal image in clue card.

CREATE TABLE IF NOT EXISTS user_route_checkpoint_completions (
  user_id INT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  checkpoint_id UUID NOT NULL REFERENCES route_checkpoints(id) ON DELETE CASCADE,
  completed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, checkpoint_id)
);

CREATE INDEX IF NOT EXISTS idx_user_checkpoint_completions_user ON user_route_checkpoint_completions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_checkpoint_completions_checkpoint ON user_route_checkpoint_completions(checkpoint_id);

COMMENT ON TABLE user_route_checkpoint_completions IS 'Checkpoints the user has solved (correct answer); used for solved icon and image reveal.';
