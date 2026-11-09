-- Social layer: profiles, follows, favorites, threaded comments with likes, activity feed,
-- notifications and push tokens. New tables reference users/spots/comments with
-- ON DELETE CASCADE, so deleting a spot or a comment also clears what points at it.

-- Profiles. Deleting an account anonymises the row (deleted_at) instead of removing it, so the
-- community's spots and comments stay readable.
ALTER TABLE users ADD COLUMN IF NOT EXISTS bio VARCHAR(280);
ALTER TABLE users ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITHOUT TIME ZONE;

CREATE TABLE IF NOT EXISTS follows (
    id BIGSERIAL PRIMARY KEY,
    follower_id BIGINT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    followee_id BIGINT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT now(),
    CONSTRAINT uk_follows_pair UNIQUE (follower_id, followee_id),
    CONSTRAINT ck_follows_not_self CHECK (follower_id <> followee_id)
);
-- uk_follows_pair serves "who do I follow"; this one serves "who follows me"
CREATE INDEX IF NOT EXISTS idx_follows_followee ON follows (followee_id);

CREATE TABLE IF NOT EXISTS favorites (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    spot_id BIGINT NOT NULL REFERENCES spots (id) ON DELETE CASCADE,
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT now(),
    CONSTRAINT uk_favorites_user_spot UNIQUE (user_id, spot_id)
);

-- Comments: one level of replies, edits, and soft delete (keeps the replies under it readable)
ALTER TABLE comments ADD COLUMN IF NOT EXISTS parent_id BIGINT REFERENCES comments (id) ON DELETE CASCADE;
ALTER TABLE comments ADD COLUMN IF NOT EXISTS edited_at TIMESTAMP WITHOUT TIME ZONE;
ALTER TABLE comments ADD COLUMN IF NOT EXISTS deleted BOOLEAN NOT NULL DEFAULT FALSE;
CREATE INDEX IF NOT EXISTS idx_comments_parent ON comments (parent_id) WHERE parent_id IS NOT NULL;
-- Top-level comments of a spot, newest first (keyset pagination on id)
CREATE INDEX IF NOT EXISTS idx_comments_spot_toplevel ON comments (spot_id, id DESC) WHERE parent_id IS NULL;

CREATE TABLE IF NOT EXISTS comment_likes (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    comment_id BIGINT NOT NULL REFERENCES comments (id) ON DELETE CASCADE,
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT now(),
    CONSTRAINT uk_comment_likes_user_comment UNIQUE (user_id, comment_id)
);
CREATE INDEX IF NOT EXISTS idx_comment_likes_comment ON comment_likes (comment_id);

-- Activity log read by the feed (fan-out on read: the feed queries the activities of the people
-- you follow, newest first, with a keyset cursor on id)
CREATE TABLE IF NOT EXISTS activities (
    id BIGSERIAL PRIMARY KEY,
    actor_id BIGINT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    type VARCHAR(32) NOT NULL,
    spot_id BIGINT REFERENCES spots (id) ON DELETE CASCADE,
    comment_id BIGINT REFERENCES comments (id) ON DELETE CASCADE,
    rating SMALLINT,
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_activities_actor ON activities (actor_id, id DESC);

CREATE TABLE IF NOT EXISTS notifications (
    id BIGSERIAL PRIMARY KEY,
    recipient_id BIGINT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    actor_id BIGINT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    type VARCHAR(32) NOT NULL,
    spot_id BIGINT REFERENCES spots (id) ON DELETE CASCADE,
    comment_id BIGINT REFERENCES comments (id) ON DELETE CASCADE,
    read_at TIMESTAMP WITHOUT TIME ZONE,
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON notifications (recipient_id, id DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications (recipient_id) WHERE read_at IS NULL;

-- Expo push tokens (one device = one token; a token moves to whoever signs in on that device)
CREATE TABLE IF NOT EXISTS push_tokens (
    id BIGSERIAL PRIMARY KEY,
    token VARCHAR(255) NOT NULL UNIQUE,
    user_id BIGINT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    platform VARCHAR(16),
    locale VARCHAR(16),
    updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_push_tokens_user ON push_tokens (user_id);
