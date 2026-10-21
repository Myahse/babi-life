-- The languages the player speaks besides French (game.Languages): a passer-by
-- who speaks one of them answers a greeting in it.
ALTER TABLE sims ADD COLUMN IF NOT EXISTS languages TEXT[] NOT NULL DEFAULT '{}';
