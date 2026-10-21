-- Tikitoko like TikTok: a post is a real short clip now (recorded from the
-- game, with a sound), the old picture staying as its poster. The clip is in
-- the bucket (video_key) when one is set up, else here (video, kept small by
-- the server). Old photo posts have no video and play as before.
ALTER TABLE tiki_posts
    ADD COLUMN video_key   TEXT NOT NULL DEFAULT '',
    ADD COLUMN video       BYTEA,
    ADD COLUMN video_mime  TEXT NOT NULL DEFAULT '',
    ADD COLUMN duration_ms INT NOT NULL DEFAULT 0,
    ADD COLUMN sound       TEXT NOT NULL DEFAULT '';

-- The game's own creators (sims/tikinpc.go) post videos made up from a seed,
-- never stored: they have negative ids. What the players do with them (likes,
-- favourites, comments) is kept here, apart from tiki_posts' foreign keys.
CREATE TABLE tiki_npc_marks (
    post       BIGINT NOT NULL CHECK (post < 0),
    sim        UUID NOT NULL REFERENCES sims(id) ON DELETE CASCADE,
    kind       TEXT NOT NULL CHECK (kind IN ('like', 'save')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (post, sim, kind)
);
CREATE INDEX tiki_npc_marks_sim_idx ON tiki_npc_marks (sim, kind, created_at DESC);

CREATE TABLE tiki_npc_comments (
    id         BIGSERIAL PRIMARY KEY,
    post       BIGINT NOT NULL CHECK (post < 0),
    sim        UUID NOT NULL REFERENCES sims(id) ON DELETE CASCADE,
    body       TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX tiki_npc_comments_post_idx ON tiki_npc_comments (post, created_at DESC);
CREATE INDEX tiki_npc_comments_sim_idx ON tiki_npc_comments (sim, created_at DESC);
