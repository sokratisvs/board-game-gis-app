-- Route-level recommendations: each exploration route can have recommended items (e.g. POIs, other routes).
-- Total XP for a route = sum of checkpoint xp_awarded (computed in API for mobile).

CREATE TABLE IF NOT EXISTS route_recommendations (
  route_id UUID NOT NULL REFERENCES exploration_routes(id) ON DELETE CASCADE,
  recommendation_id UUID NOT NULL REFERENCES recommendations(id) ON DELETE CASCADE,
  PRIMARY KEY (route_id, recommendation_id)
);

CREATE INDEX IF NOT EXISTS idx_route_recommendations_route_id ON route_recommendations(route_id);

COMMENT ON TABLE route_recommendations IS 'Recommendations attached to an exploration route (shown to mobile user for the route).';
