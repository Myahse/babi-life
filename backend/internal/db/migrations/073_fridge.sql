-- What a Sim keeps in the fridge of its house (game/fridge.go): item id → how many.
ALTER TABLE sims ADD COLUMN IF NOT EXISTS fridge JSONB NOT NULL DEFAULT '{}'::jsonb;
