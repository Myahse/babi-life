-- Stories: a photo taken in the game (or, when the server allows it, from the
-- phone), seen by the Sim's friends for 24 hours. Tikitoko: short posts seen
-- by every player, likes, follows, and the Sim's audience.
CREATE TABLE stories (
    id         BIGSERIAL PRIMARY KEY,
    sim        UUID NOT NULL REFERENCES sims(id) ON DELETE CASCADE,
    image      BYTEA NOT NULL,
    mime       TEXT NOT NULL,
    caption    TEXT NOT NULL DEFAULT '',
    source     TEXT NOT NULL DEFAULT 'jeu', -- 'jeu' | 'reel'
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT now() + interval '24 hours'
);
CREATE INDEX stories_sim_idx ON stories (sim, expires_at);

CREATE TABLE story_views (
    story  BIGINT NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
    viewer UUID NOT NULL REFERENCES sims(id) ON DELETE CASCADE,
    PRIMARY KEY (story, viewer)
);

CREATE TABLE tiki_posts (
    id         BIGSERIAL PRIMARY KEY,
    sim        UUID NOT NULL REFERENCES sims(id) ON DELETE CASCADE,
    image      BYTEA NOT NULL,
    mime       TEXT NOT NULL,
    caption    TEXT NOT NULL DEFAULT '',
    theme      TEXT NOT NULL,
    place      TEXT NOT NULL DEFAULT '',
    views      INT NOT NULL DEFAULT 0,   -- the game's audience
    likes      INT NOT NULL DEFAULT 0,   -- the game's audience
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX tiki_posts_new_idx ON tiki_posts (created_at DESC);
CREATE INDEX tiki_posts_sim_idx ON tiki_posts (sim, created_at DESC);

CREATE TABLE tiki_likes (
    post BIGINT NOT NULL REFERENCES tiki_posts(id) ON DELETE CASCADE,
    sim  UUID NOT NULL REFERENCES sims(id) ON DELETE CASCADE,
    PRIMARY KEY (post, sim)
);

CREATE TABLE tiki_follows (
    follower UUID NOT NULL REFERENCES sims(id) ON DELETE CASCADE,
    followed UUID NOT NULL REFERENCES sims(id) ON DELETE CASCADE,
    PRIMARY KEY (follower, followed)
);

-- The Sim's Tikitoko audience (fans the game brings, players' follows apart).
ALTER TABLE sims ADD COLUMN tiki_fans INT NOT NULL DEFAULT 0;

-- Reports can be about a story or a post too.
ALTER TABLE reports
    ADD COLUMN story_id BIGINT REFERENCES stories(id) ON DELETE SET NULL,
    ADD COLUMN post_id BIGINT REFERENCES tiki_posts(id) ON DELETE SET NULL;
