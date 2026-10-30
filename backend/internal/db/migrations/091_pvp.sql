-- Les jeux contre de vrais joueurs (update « jeux-en-ligne », sims/pvp.go).
-- pvp_results: each game played out between two players (winner and loser,
-- or a draw), for the « Classement » of each game. pvp_stakes: what a player
-- put on a match the server keeps in memory (le godé): paid out at the end,
-- given back if the server stopped before (on start, see Handler.RefundPvp).
-- dames.live, huit.live: a game started from « Jouer contre un joueur »,
-- played on the spot: a minute and a half per move, then the one who had to
-- play loses it.
CREATE TABLE IF NOT EXISTS pvp_results (
	id BIGSERIAL PRIMARY KEY,
	game TEXT NOT NULL,
	winner UUID REFERENCES sims(id) ON DELETE CASCADE,
	loser UUID REFERENCES sims(id) ON DELETE CASCADE,
	draw BOOLEAN NOT NULL DEFAULT false,
	stake INT NOT NULL DEFAULT 0,
	created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS pvp_results_game ON pvp_results (game, winner);
CREATE INDEX IF NOT EXISTS pvp_results_loser ON pvp_results (game, loser);

CREATE TABLE IF NOT EXISTS pvp_stakes (
	match TEXT NOT NULL,
	sim UUID NOT NULL REFERENCES sims(id) ON DELETE CASCADE,
	amount INT NOT NULL,
	created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
	PRIMARY KEY (match, sim)
);

ALTER TABLE dames ADD COLUMN IF NOT EXISTS live BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE huit ADD COLUMN IF NOT EXISTS live BOOLEAN NOT NULL DEFAULT false;
