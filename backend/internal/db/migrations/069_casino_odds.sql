-- The casino's « taux de retour » as the team sets them from the admin (backend
-- odds/, game/odds.go): every change kept with its moment (a round is played
-- at the rate of when it began). game: a game's id or '*' (the level for all);
-- rate: null brings it back (to the level for all, or untouched).
CREATE TABLE IF NOT EXISTS casino_odds (
	id BIGSERIAL PRIMARY KEY,
	game TEXT NOT NULL,
	rate DOUBLE PRECISION,
	at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- The rounds of the money games that keep no table of their own (the slots,
-- the roulette, le 21, the tickets), for the « Historique » in each game.
CREATE TABLE IF NOT EXISTS game_rounds (
	id BIGSERIAL PRIMARY KEY,
	sim UUID NOT NULL REFERENCES sims(id) ON DELETE CASCADE,
	game TEXT NOT NULL,
	stake INT NOT NULL,
	payout INT NOT NULL DEFAULT 0,
	detail TEXT NOT NULL DEFAULT '',
	created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS game_rounds_sim_idx ON game_rounds (sim, game, created_at DESC);
