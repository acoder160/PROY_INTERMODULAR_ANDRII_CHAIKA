-- Live layer: "I'm skating here" check-ins and planned skate sessions.

-- A check-in lasts two hours unless the skater leaves earlier (ended_at). A skater is at one spot
-- at a time: checking in somewhere else ends the previous one.
CREATE TABLE IF NOT EXISTS checkins (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    spot_id BIGINT NOT NULL REFERENCES spots (id) ON DELETE CASCADE,
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT now(),
    expires_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    ended_at TIMESTAMP WITHOUT TIME ZONE
);
-- Active check-ins (the live counts and the expiry job only ever read these)
CREATE INDEX IF NOT EXISTS idx_checkins_active_spot ON checkins (spot_id) WHERE ended_at IS NULL;
-- At most one active check-in per skater, enforced by the database
CREATE UNIQUE INDEX IF NOT EXISTS uk_checkins_active_user ON checkins (user_id) WHERE ended_at IS NULL;

-- "Meet at this spot at 18:00": anyone can join; participants get a push 30 minutes before
CREATE TABLE IF NOT EXISTS skate_sessions (
    id BIGSERIAL PRIMARY KEY,
    spot_id BIGINT NOT NULL REFERENCES spots (id) ON DELETE CASCADE,
    host_id BIGINT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    starts_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    note VARCHAR(200),
    reminded_at TIMESTAMP WITHOUT TIME ZONE,
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sessions_spot_start ON skate_sessions (spot_id, starts_at);
-- The reminder job looks for sessions starting soon that haven't been reminded yet
CREATE INDEX IF NOT EXISTS idx_sessions_reminder ON skate_sessions (starts_at) WHERE reminded_at IS NULL;

CREATE TABLE IF NOT EXISTS session_participants (
    id BIGSERIAL PRIMARY KEY,
    session_id BIGINT NOT NULL REFERENCES skate_sessions (id) ON DELETE CASCADE,
    user_id BIGINT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT now(),
    CONSTRAINT uk_session_participant UNIQUE (session_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_session_participants_user ON session_participants (user_id);

-- Feed items can now point at a session
ALTER TABLE activities ADD COLUMN IF NOT EXISTS session_id BIGINT REFERENCES skate_sessions (id) ON DELETE CASCADE;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS session_id BIGINT REFERENCES skate_sessions (id) ON DELETE CASCADE;
