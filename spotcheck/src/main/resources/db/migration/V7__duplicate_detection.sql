-- Duplicate spot detection: trigram similarity of names (pg_trgm ships with PostgreSQL contrib,
-- available on the PostGIS image and on managed Postgres). Candidates are first narrowed by
-- distance with the geography index (V4), so no trigram index is needed.
CREATE EXTENSION IF NOT EXISTS pg_trgm;
