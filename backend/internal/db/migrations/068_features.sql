-- The game's updates (backend features/, web screens/Admin.tsx « Mises à jour »):
-- each new feature ships closed, and the team opens it from the admin, now or
-- at a set time, so the players see the game grow week after week. A feature
-- with no row here is closed.
CREATE TABLE IF NOT EXISTS features (
	id TEXT PRIMARY KEY,
	open BOOLEAN NOT NULL DEFAULT false,
	-- Opens by itself at this moment (null: by hand only).
	opens_at TIMESTAMPTZ,
	-- When the players first got it (kept when closed again, for the « Nouveau » card).
	opened_at TIMESTAMPTZ,
	updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
