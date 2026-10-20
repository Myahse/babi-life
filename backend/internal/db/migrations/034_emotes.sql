-- The emotes a Sim has bought (game/emotes.go); the free ones aren't listed.
ALTER TABLE sims ADD COLUMN emotes TEXT[] NOT NULL DEFAULT '{}';
