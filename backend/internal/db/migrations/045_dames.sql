-- Les dames (sims/dames.go): a game against a man of the grin (black NULL,
-- npc_name, how far he looks ahead) or between two player friends, for a stake.
-- board: the 50 dark squares in letters (w W b B .); turn: 1 white, -1 black;
-- quiet: plies of dames moving with nothing taken (a draw at 50); last: the
-- last move (JSON); status: invited, playing, done, declined, expired.
CREATE TABLE IF NOT EXISTS dames (
	id BIGSERIAL PRIMARY KEY,
	white UUID NOT NULL REFERENCES sims(id) ON DELETE CASCADE,
	black UUID REFERENCES sims(id) ON DELETE CASCADE,
	npc_name TEXT NOT NULL DEFAULT '',
	depth SMALLINT NOT NULL DEFAULT 2,
	stake INT NOT NULL DEFAULT 0,
	board TEXT NOT NULL,
	turn SMALLINT NOT NULL DEFAULT 1,
	quiet INT NOT NULL DEFAULT 0,
	status TEXT NOT NULL DEFAULT 'invited',
	winner SMALLINT NOT NULL DEFAULT 0,
	last TEXT NOT NULL DEFAULT '',
	result TEXT NOT NULL DEFAULT '',
	created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
	updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS dames_white ON dames (white, id DESC);
CREATE INDEX IF NOT EXISTS dames_black ON dames (black, id DESC) WHERE black IS NOT NULL;
