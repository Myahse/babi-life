-- Babigram, the photo app (sims/babigram.go): square or portrait photos in a
-- feed, likes, comments, saves, follows of its own (apart from Tikitoko's).
-- A post is a player's (sim, with its JPEG) or one of the game's accounts'
-- (npc, no image: the app paints it from seed and scene); key keeps the
-- game's posts from being written twice when several servers catch up.
CREATE TABLE gram_posts (
    id         BIGSERIAL PRIMARY KEY,
    sim        UUID REFERENCES sims(id) ON DELETE CASCADE,
    npc        TEXT NOT NULL DEFAULT '',
    key        TEXT UNIQUE,
    image      BYTEA,
    mime       TEXT NOT NULL DEFAULT '',
    ratio      TEXT NOT NULL DEFAULT 'carre',   -- 'carre' | 'portrait'
    filter     TEXT NOT NULL DEFAULT '',
    caption    TEXT NOT NULL DEFAULT '',
    place      TEXT NOT NULL DEFAULT '',
    scene      TEXT NOT NULL DEFAULT '',        -- the game's posts: what's painted
    seed       BIGINT NOT NULL DEFAULT 0,
    reach      INT NOT NULL DEFAULT 0,          -- the game's audience
    likes      INT NOT NULL DEFAULT 0,          -- the game's audience
    shares     INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (sim IS NOT NULL OR npc <> '')
);
CREATE INDEX gram_posts_new_idx ON gram_posts (created_at DESC);
CREATE INDEX gram_posts_sim_idx ON gram_posts (sim, created_at DESC);
CREATE INDEX gram_posts_npc_idx ON gram_posts (npc, created_at DESC) WHERE npc <> '';

CREATE TABLE gram_likes (
    post       BIGINT NOT NULL REFERENCES gram_posts(id) ON DELETE CASCADE,
    sim        UUID NOT NULL REFERENCES sims(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (post, sim)
);

CREATE TABLE gram_follows (
    follower   UUID NOT NULL REFERENCES sims(id) ON DELETE CASCADE,
    followed   UUID NOT NULL REFERENCES sims(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (follower, followed)
);
CREATE INDEX gram_follows_followed_idx ON gram_follows (followed, created_at DESC);

-- Following one of the game's accounts.
CREATE TABLE gram_npc_follows (
    follower   UUID NOT NULL REFERENCES sims(id) ON DELETE CASCADE,
    npc        TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (follower, npc)
);

CREATE TABLE gram_comments (
    id         BIGSERIAL PRIMARY KEY,
    post       BIGINT NOT NULL REFERENCES gram_posts(id) ON DELETE CASCADE,
    sim        UUID NOT NULL REFERENCES sims(id) ON DELETE CASCADE,
    body       TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX gram_comments_post_idx ON gram_comments (post, created_at DESC);
CREATE INDEX gram_comments_sim_idx ON gram_comments (sim, created_at DESC);

CREATE TABLE gram_comment_likes (
    comment BIGINT NOT NULL REFERENCES gram_comments(id) ON DELETE CASCADE,
    sim     UUID NOT NULL REFERENCES sims(id) ON DELETE CASCADE,
    PRIMARY KEY (comment, sim)
);

CREATE TABLE gram_saves (
    post       BIGINT NOT NULL REFERENCES gram_posts(id) ON DELETE CASCADE,
    sim        UUID NOT NULL REFERENCES sims(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (post, sim)
);

-- The Sim's Babigram audience (followers the game brings) and its bio.
ALTER TABLE sims ADD COLUMN gram_fans INT NOT NULL DEFAULT 0;
ALTER TABLE sims ADD COLUMN gram_bio TEXT NOT NULL DEFAULT '';

-- A reported photo or comment, kept for the moderators.
ALTER TABLE reports
    ADD COLUMN gram_post_id BIGINT REFERENCES gram_posts(id) ON DELETE SET NULL,
    ADD COLUMN gram_comment_id BIGINT REFERENCES gram_comments(id) ON DELETE SET NULL;
