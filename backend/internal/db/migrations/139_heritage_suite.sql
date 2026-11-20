-- L'héritage, phase 2 (the update « heritage », sims/heritage2.go).
-- couple_kids: a child of two players (love_stage officiel or more, both consenting through love_requests
-- kind 'bebe'). kid is the child as both families mirror it (Famille.Kids, Kid.Shared = id): its name, gender,
-- seed, traits. born_at: when it was conceived (each parent's played clock brings it home). taken_by: the
-- parent who handed down to it first (locked FOR UPDATE at the passation); the other chooses another heir.
-- A parent's account deleted leaves the child with the other.
CREATE TABLE IF NOT EXISTS couple_kids (
    id       BIGSERIAL PRIMARY KEY,
    sim_a    UUID REFERENCES sims(id) ON DELETE SET NULL,
    sim_b    UUID REFERENCES sims(id) ON DELETE SET NULL,
    kid      JSONB NOT NULL,
    born_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    taken_by UUID REFERENCES sims(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS couple_kids_a ON couple_kids (sim_a);
CREATE INDEX IF NOT EXISTS couple_kids_b ON couple_kids (sim_b);

-- generation_feats: what a generation did, written as it happens (an office won, a diploma, a career's rung,
-- a marriage…), so that its renom counts its history, not only what it holds at the passation.
CREATE TABLE IF NOT EXISTS generation_feats (
    sim_id UUID NOT NULL REFERENCES sims(id) ON DELETE CASCADE,
    gen    INT NOT NULL,
    kind   TEXT NOT NULL,
    detail TEXT NOT NULL DEFAULT '',
    at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (sim_id, gen, kind, detail)
);

-- bonds between players: tonton_a, the sim_a is a parent's friend to the sim_b's heir (« tonton », « tata »);
-- tonton_b the other way round. Set at a passation.
ALTER TABLE bonds ADD COLUMN IF NOT EXISTS tonton_a BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE bonds ADD COLUMN IF NOT EXISTS tonton_b BOOLEAN NOT NULL DEFAULT false;

-- pvp_results: the generation each player was at (the rankings count the current one; none: the first).
ALTER TABLE pvp_results ADD COLUMN IF NOT EXISTS winner_gen INT;
ALTER TABLE pvp_results ADD COLUMN IF NOT EXISTS loser_gen INT;
