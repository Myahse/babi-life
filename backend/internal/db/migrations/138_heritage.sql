-- L'héritage (the update « heritage », sims/heritage.go): the sims row is the lineage. generation: which
-- generation of the family is played now; renom: the family's renom (summed at each passation, the great
-- families' ranking); generation_since: when this generation began (the 21 real days' floor between two
-- passations; for the Sims already there, set again when the update first reaches them).
ALTER TABLE sims ADD COLUMN IF NOT EXISTS generation INT NOT NULL DEFAULT 1;
ALTER TABLE sims ADD COLUMN IF NOT EXISTS renom INT NOT NULL DEFAULT 0;
ALTER TABLE sims ADD COLUMN IF NOT EXISTS generation_since TIMESTAMPTZ NOT NULL DEFAULT now();
CREATE INDEX IF NOT EXISTS sims_renom ON sims (renom DESC) WHERE renom > 0;

-- Each generation handed down: who it was, what it left (the estate, the duties, what the heir and the
-- elder's pot got), its renom and its jalons (feats), for the family tree and the history.
CREATE TABLE IF NOT EXISTS family_generations (
    sim_id      UUID NOT NULL REFERENCES sims(id) ON DELETE CASCADE,
    n           INT NOT NULL,
    first_name  TEXT NOT NULL,
    gender      TEXT NOT NULL,
    look        JSONB NOT NULL DEFAULT '{}',
    family_tier TEXT NOT NULL DEFAULT '',
    years       INT NOT NULL DEFAULT 0,
    heir_kind   TEXT NOT NULL DEFAULT '',
    estate      BIGINT NOT NULL DEFAULT 0,
    fee         BIGINT NOT NULL DEFAULT 0,
    inherited   BIGINT NOT NULL DEFAULT 0,
    elder_pot   BIGINT NOT NULL DEFAULT 0,
    renom       INT NOT NULL DEFAULT 0,
    feats       TEXT[] NOT NULL DEFAULT '{}',
    began_at    TIMESTAMPTZ NOT NULL,
    retired_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (sim_id, n)
);
