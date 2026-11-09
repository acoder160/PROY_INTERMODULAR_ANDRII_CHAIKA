-- Safety tools for user-generated content: blocking people, and reports on comments and profiles
-- (spot reports already have their own table, see V3).

CREATE TABLE IF NOT EXISTS user_blocks (
    id BIGSERIAL PRIMARY KEY,
    blocker_id BIGINT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    blocked_id BIGINT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT now(),
    CONSTRAINT uk_user_blocks_pair UNIQUE (blocker_id, blocked_id),
    CONSTRAINT ck_user_blocks_not_self CHECK (blocker_id <> blocked_id)
);
-- uk_user_blocks_pair serves "who did I block"; this one serves "who blocked me"
CREATE INDEX IF NOT EXISTS idx_user_blocks_blocked ON user_blocks (blocked_id);

-- target_type is COMMENT or USER (a profile: bio and avatar); target_id points at comments.id / users.id.
-- No foreign key on target_id because it points at two tables; the admin queue skips targets that are gone.
CREATE TABLE IF NOT EXISTS content_reports (
    id BIGSERIAL PRIMARY KEY,
    reporter_id BIGINT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    target_type VARCHAR(16) NOT NULL,
    target_id BIGINT NOT NULL,
    reason VARCHAR(32) NOT NULL,
    comment VARCHAR(300),
    status VARCHAR(16) NOT NULL DEFAULT 'OPEN',
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT now(),
    resolved_at TIMESTAMP WITHOUT TIME ZONE,
    resolved_by VARCHAR(50),
    CONSTRAINT uk_content_reports_once UNIQUE (reporter_id, target_type, target_id)
);
CREATE INDEX IF NOT EXISTS idx_content_reports_open ON content_reports (status, id DESC);
