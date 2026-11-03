-- The PNJ players (sims/pnj.go): what each remembers of a Sim: how many times they met, and the last
-- invitation of theirs it answered (the slot), so it isn't asked again.
CREATE TABLE IF NOT EXISTS pnj_bonds (
    sim_id        UUID NOT NULL REFERENCES sims(id) ON DELETE CASCADE,
    pnj           TEXT NOT NULL,
    met           INT NOT NULL DEFAULT 0,
    answered_slot BIGINT NOT NULL DEFAULT 0,
    PRIMARY KEY (sim_id, pnj)
);
