-- Optional validation radius per checkpoint (for play flow / batch import).

ALTER TABLE route_checkpoints
  ADD COLUMN IF NOT EXISTS validation_radius_meters INTEGER;

COMMENT ON COLUMN route_checkpoints.validation_radius_meters IS 'Optional radius in meters for validating player at this checkpoint';
