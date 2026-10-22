-- 8 américain (sims/huit.go, game/huit.go): a table of the Sim (host) and
-- one to three of the game's players (bots, their names), or the Sim and a
-- player friend (guest), for a stake each. state: the cards and the turn
-- (game.Huit, JSON); winner: the seat (-1 none); status: invited, playing,
-- done, declined, expired.
CREATE TABLE IF NOT EXISTS huit (
	id BIGSERIAL PRIMARY KEY,
	host UUID NOT NULL REFERENCES sims(id) ON DELETE CASCADE,
	guest UUID REFERENCES sims(id) ON DELETE CASCADE,
	bots TEXT[] NOT NULL DEFAULT '{}',
	stake INT NOT NULL DEFAULT 0,
	state JSONB NOT NULL,
	status TEXT NOT NULL DEFAULT 'invited',
	winner SMALLINT NOT NULL DEFAULT -1,
	result TEXT NOT NULL DEFAULT '',
	created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
	updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS huit_host ON huit (host, id DESC);
CREATE INDEX IF NOT EXISTS huit_guest ON huit (guest, id DESC) WHERE guest IS NOT NULL;
