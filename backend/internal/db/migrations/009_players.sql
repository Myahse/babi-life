-- An online game: Sims of different players meet in the same commune.
-- Invitations: one player greets another, or asks them to join what they're doing.
CREATE TABLE invites (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    from_sim       UUID NOT NULL REFERENCES sims(id) ON DELETE CASCADE,
    to_sim         UUID NOT NULL REFERENCES sims(id) ON DELETE CASCADE,
    place_id       TEXT NOT NULL,
    interaction_id TEXT NOT NULL,
    label          TEXT NOT NULL,
    status         TEXT NOT NULL DEFAULT 'pending', -- 'pending' | 'accepted' | 'declined'
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX invites_to_sim_idx ON invites (to_sim, status);

-- Friendship between two players' Sims (sim_a < sim_b).
CREATE TABLE bonds (
    sim_a      UUID NOT NULL REFERENCES sims(id) ON DELETE CASCADE,
    sim_b      UUID NOT NULL REFERENCES sims(id) ON DELETE CASCADE,
    friendship INT NOT NULL DEFAULT 0,
    met_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    seen_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (sim_a, sim_b)
);

CREATE INDEX sims_where_idx ON sims (city, commune, last_tick);
