-- Indexes for the hot read paths. All additive and idempotent.

-- /api/spots/nearby (ST_DWithin on location)
CREATE INDEX IF NOT EXISTS idx_spots_location
    ON spots USING GIST (location);

-- Comments of a spot, newest first
CREATE INDEX IF NOT EXISTS idx_comments_spot_created
    ON comments (spot_id, created_at DESC);

-- Ratings of a spot (average + per-author stars). The existing unique
-- constraint (user_id, spot_id) starts with user_id, so it can't serve these.
CREATE INDEX IF NOT EXISTS idx_ratings_spot
    ON ratings (spot_id);
