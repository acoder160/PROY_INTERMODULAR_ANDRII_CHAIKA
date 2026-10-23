CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE IF NOT EXISTS users (
    id BIGSERIAL PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    email VARCHAR(100) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    avatar_url VARCHAR(255),
    role VARCHAR(255) NOT NULL DEFAULT 'ROLE_USER',
    token_version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITHOUT TIME ZONE
);

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS token_version BIGINT NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS spots (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    location geometry(Point, 4326) NOT NULL,
    spot_type VARCHAR(255) NOT NULL,
    difficulty_level VARCHAR(255) NOT NULL,
    surface_rating DOUBLE PRECISION DEFAULT 0.0,
    created_by BIGINT NOT NULL,
    created_at TIMESTAMP WITHOUT TIME ZONE,
    media_url VARCHAR(500),
    CONSTRAINT fk_spots_created_by
        FOREIGN KEY (created_by) REFERENCES users (id)
);

CREATE TABLE IF NOT EXISTS comments (
    id BIGSERIAL PRIMARY KEY,
    content TEXT NOT NULL,
    spot_id BIGINT NOT NULL,
    user_id BIGINT NOT NULL,
    created_at TIMESTAMP WITHOUT TIME ZONE,
    CONSTRAINT fk_comments_spot
        FOREIGN KEY (spot_id) REFERENCES spots (id),
    CONSTRAINT fk_comments_user
        FOREIGN KEY (user_id) REFERENCES users (id)
);

CREATE TABLE IF NOT EXISTS ratings (
    id BIGSERIAL PRIMARY KEY,
    surface_rating INTEGER NOT NULL,
    spot_id BIGINT NOT NULL,
    user_id BIGINT NOT NULL,
    created_at TIMESTAMP WITHOUT TIME ZONE,
    CONSTRAINT uk_ratings_user_spot UNIQUE (user_id, spot_id),
    CONSTRAINT fk_ratings_spot
        FOREIGN KEY (spot_id) REFERENCES spots (id),
    CONSTRAINT fk_ratings_user
        FOREIGN KEY (user_id) REFERENCES users (id)
);

CREATE TABLE IF NOT EXISTS refresh_sessions (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL,
    token_hash VARCHAR(64) NOT NULL UNIQUE,
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    expires_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    revoked_at TIMESTAMP WITHOUT TIME ZONE,
    family_id UUID NOT NULL,
    reuse_detected BOOLEAN NOT NULL DEFAULT FALSE,
    CONSTRAINT fk_refresh_sessions_user
        FOREIGN KEY (user_id) REFERENCES users (id)
);

CREATE INDEX IF NOT EXISTS idx_refresh_sessions_user_id
    ON refresh_sessions (user_id);

CREATE INDEX IF NOT EXISTS idx_refresh_sessions_family_id
    ON refresh_sessions (family_id);
