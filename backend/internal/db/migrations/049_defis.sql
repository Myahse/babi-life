-- Les défis (sims/defi.go): the best score of each défi a Sim took on (the tea
-- at the grin, the water-ski, the shopping list), and how many times it played it.
CREATE TABLE IF NOT EXISTS defis (
	sim_id UUID NOT NULL REFERENCES sims(id) ON DELETE CASCADE,
	kind TEXT NOT NULL,
	best SMALLINT NOT NULL DEFAULT 0,
	played INT NOT NULL DEFAULT 0,
	updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
	PRIMARY KEY (sim_id, kind)
);
