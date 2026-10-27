-- The boutiques' pieces a Sim has bought (game/clothes.go), kept in its wardrobe.
ALTER TABLE sims ADD COLUMN IF NOT EXISTS clothes TEXT[] NOT NULL DEFAULT '{}';
