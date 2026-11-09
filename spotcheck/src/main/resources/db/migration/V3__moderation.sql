-- Moderation: user reports, spots/photos hidden pending admin review, reporter reputation.
-- Additive and idempotent.

-- Spot visibility. HIDDEN spots are left out of every public read until an admin decides.
ALTER TABLE spots ADD COLUMN IF NOT EXISTS status VARCHAR(16) NOT NULL DEFAULT 'VISIBLE';
-- HIDDEN = the photo is not served (spot stays on the map without it)
ALTER TABLE spots ADD COLUMN IF NOT EXISTS photo_status VARCHAR(16) NOT NULL DEFAULT 'OK';
-- Set when an admin has looked at the spot; NULL = still in the "new" queue
ALTER TABLE spots ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMP WITHOUT TIME ZONE;
-- Weighted reports needed to hide the spot automatically (raised after an admin keeps it)
ALTER TABLE spots ADD COLUMN IF NOT EXISTS report_threshold INTEGER NOT NULL DEFAULT 3;
-- Last AI review of the reports: VIOLATION / OK / UNSURE, with the model's explanation
ALTER TABLE spots ADD COLUMN IF NOT EXISTS ai_verdict VARCHAR(16);
ALTER TABLE spots ADD COLUMN IF NOT EXISTS ai_reason TEXT;
ALTER TABLE spots ADD COLUMN IF NOT EXISTS ai_checked_at TIMESTAMP WITHOUT TIME ZONE;

-- Spots that existed before this migration do not flood the "new" queue
UPDATE spots SET reviewed_at = now() WHERE reviewed_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_spots_status ON spots (status);

-- Reporter reputation, updated only by admin decisions
ALTER TABLE users ADD COLUMN IF NOT EXISTS reports_upheld INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS reports_rejected INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS spot_reports (
    id BIGSERIAL PRIMARY KEY,
    spot_id BIGINT NOT NULL,
    reporter_id BIGINT NOT NULL,
    reason VARCHAR(32) NOT NULL,
    comment VARCHAR(500),
    -- OPEN, AI_DISMISSED (AI judged it a false alarm), UPHELD, REJECTED (admin decisions)
    status VARCHAR(16) NOT NULL DEFAULT 'OPEN',
    weight DOUBLE PRECISION NOT NULL DEFAULT 1,
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT now(),
    resolved_at TIMESTAMP WITHOUT TIME ZONE,
    CONSTRAINT uk_spot_reports_spot_reporter UNIQUE (spot_id, reporter_id),
    CONSTRAINT fk_spot_reports_spot FOREIGN KEY (spot_id) REFERENCES spots (id) ON DELETE CASCADE,
    CONSTRAINT fk_spot_reports_reporter FOREIGN KEY (reporter_id) REFERENCES users (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_spot_reports_spot_status ON spot_reports (spot_id, status);
CREATE INDEX IF NOT EXISTS idx_spot_reports_status ON spot_reports (status);

-- Log of admin decisions. No foreign keys on purpose: the entry outlives the deleted spot/comment.
CREATE TABLE IF NOT EXISTS moderation_actions (
    id BIGSERIAL PRIMARY KEY,
    spot_id BIGINT,
    spot_name VARCHAR(100),
    author_username VARCHAR(50),
    -- KEEP, REMOVE_SPOT, REMOVE_PHOTO, RESTORE_PHOTO, DELETE_COMMENT
    action VARCHAR(32) NOT NULL,
    reason VARCHAR(500),
    admin_username VARCHAR(50),
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_moderation_actions_created ON moderation_actions (created_at DESC);
