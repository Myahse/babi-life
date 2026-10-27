-- Le godé against the game's players (sims/gode.go): how many rounds were played (whose turn it is to throw first), and the round going on.
CREATE TABLE IF NOT EXISTS gode (
	sim_id UUID PRIMARY KEY REFERENCES sims(id) ON DELETE CASCADE,
	played INT NOT NULL DEFAULT 0,
	round JSONB
);
