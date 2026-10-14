-- Each Sim's plot: the house the player builds there, block by block.
CREATE TABLE plots (
    sim_id     UUID PRIMARY KEY REFERENCES sims(id) ON DELETE CASCADE,
    blocks     JSONB NOT NULL DEFAULT '[]', -- [[x, y, z, "material"], …]
    built      INT NOT NULL DEFAULT 0,      -- blocks ever placed: unlocks better materials
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
