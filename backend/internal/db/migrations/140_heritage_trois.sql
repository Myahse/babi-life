-- L'héritage, phase 3 (the update « heritage », sims/heritage3.go).
-- crest: the family's crest (shape, colours, emblem, devise) as the others see it (the ranking, the houses,
-- Babi Direct); the family keeps its own copy, with the generation it was chosen in, in life.famille.
ALTER TABLE sims ADD COLUMN IF NOT EXISTS crest JSONB;

-- heirlooms: the family's « objets de famille ». The thing stays where it is (a piece of furniture in a house,
-- a piece in the wardrobe, a vehicle); kind + item say which (a furniture's id, a piece's id, vehicles.id).
-- ref, color: what draws it; gens: the times it was handed down; lines: engraved at each (« De Awa à
-- Lassina »); renom: what it added at its last passation.
CREATE TABLE IF NOT EXISTS heirlooms (
    id     BIGSERIAL PRIMARY KEY,
    sim_id UUID NOT NULL REFERENCES sims(id) ON DELETE CASCADE,
    kind   TEXT NOT NULL,
    item   TEXT NOT NULL,
    label  TEXT NOT NULL,
    ref    TEXT NOT NULL DEFAULT '',
    color  TEXT NOT NULL DEFAULT '',
    gens   INT NOT NULL DEFAULT 1,
    lines  TEXT[] NOT NULL DEFAULT '{}',
    renom  INT NOT NULL DEFAULT 0,
    at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (sim_id, kind, item)
);

-- renom_log: each renom gained and when (a passation, the weekly fête), for the week's great families.
CREATE TABLE IF NOT EXISTS renom_log (
    sim_id UUID NOT NULL REFERENCES sims(id) ON DELETE CASCADE,
    pts    INT NOT NULL,
    why    TEXT NOT NULL DEFAULT '',
    at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS renom_log_at ON renom_log (at);

-- babi_direct.extra: what a post shows besides its text (the fête's podium: the families and their crests).
ALTER TABLE babi_direct ADD COLUMN IF NOT EXISTS extra JSONB;
