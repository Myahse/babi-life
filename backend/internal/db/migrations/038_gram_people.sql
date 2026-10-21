-- The people met in the game (a passer-by, someone at the maquis, the club…)
-- who became a player's friend have a Babigram account of their own
-- (sims/gramfriends.go). They're the same person for everyone (the world's
-- id: sims.Passerby.ID), so their account is public; their photos are
-- gram_posts with npc = id, like the game's own accounts.
CREATE TABLE gram_people (
    id         TEXT PRIMARY KEY,
    name       TEXT NOT NULL,
    gender     TEXT NOT NULL,
    look       JSONB NOT NULL DEFAULT '{}',
    seed       INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
