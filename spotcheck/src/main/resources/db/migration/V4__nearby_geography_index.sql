-- /api/spots/nearby measures real metres on the sphere: ST_DWithin(geography, geography, metres).
-- The GIST index on the geometry column (V2) can't serve a comparison on location::geography,
-- so that expression gets its own index. Without it every nearby search scans the whole table.
CREATE INDEX IF NOT EXISTS idx_spots_location_geog
    ON spots USING GIST ((location::geography));
