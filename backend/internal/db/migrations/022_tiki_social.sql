-- Tikitoko like TikTok: comments under each video, favourites, shares.
CREATE TABLE tiki_comments (
    id         BIGSERIAL PRIMARY KEY,
    post       BIGINT NOT NULL REFERENCES tiki_posts(id) ON DELETE CASCADE,
    sim        UUID NOT NULL REFERENCES sims(id) ON DELETE CASCADE,
    body       TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX tiki_comments_post_idx ON tiki_comments (post, created_at DESC);
CREATE INDEX tiki_comments_sim_idx ON tiki_comments (sim, created_at DESC);

CREATE TABLE tiki_comment_likes (
    comment BIGINT NOT NULL REFERENCES tiki_comments(id) ON DELETE CASCADE,
    sim     UUID NOT NULL REFERENCES sims(id) ON DELETE CASCADE,
    PRIMARY KEY (comment, sim)
);

CREATE TABLE tiki_saves (
    post       BIGINT NOT NULL REFERENCES tiki_posts(id) ON DELETE CASCADE,
    sim        UUID NOT NULL REFERENCES sims(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (post, sim)
);

ALTER TABLE tiki_posts ADD COLUMN shares INT NOT NULL DEFAULT 0;
-- A reported comment, kept for the moderators.
ALTER TABLE reports ADD COLUMN comment_id BIGINT REFERENCES tiki_comments(id) ON DELETE SET NULL;
