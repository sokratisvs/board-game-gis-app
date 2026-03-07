-- Route-level cover image URL (parent image for the route). Optional.
-- When set, list/detail use it; otherwise fall back to first checkpoint image.

ALTER TABLE routes
  ADD COLUMN IF NOT EXISTS image_url TEXT;

COMMENT ON COLUMN routes.image_url IS 'Optional cover image URL for the route (e.g. from batch import or editor).';
