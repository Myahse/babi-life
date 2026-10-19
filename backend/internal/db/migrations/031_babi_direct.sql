-- Babi Direct, in the grin's « Tout Babi » room: what happens in the game,
-- posted by the game (the communes' happenings, the stadiums, Bet225's
-- results, the players' big moments). Key: one post per thing, however many
-- servers catch up. Kept for a week. A player's moment goes with the Sim.
CREATE TABLE babi_direct (
    id      BIGSERIAL PRIMARY KEY,
    key     TEXT NOT NULL UNIQUE,
    kind    TEXT NOT NULL,                 -- 'quartier' | 'stade' | 'bet' | 'joueur'
    emoji   TEXT NOT NULL,
    body    TEXT NOT NULL,
    commune TEXT NOT NULL DEFAULT '',
    sim     UUID REFERENCES sims(id) ON DELETE CASCADE,
    at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX babi_direct_at_idx ON babi_direct (at DESC);

-- One reaction per player and post.
CREATE TABLE babi_direct_reactions (
    post  BIGINT NOT NULL REFERENCES babi_direct(id) ON DELETE CASCADE,
    sim   UUID NOT NULL REFERENCES sims(id) ON DELETE CASCADE,
    emoji TEXT NOT NULL,
    PRIMARY KEY (post, sim)
);
