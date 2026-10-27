-- Where a lot stands, picked by the player on the map (sims/plot.go); NULL: the spot the game drew for it.
ALTER TABLE plots ADD COLUMN IF NOT EXISTS lot_lat DOUBLE PRECISION;
ALTER TABLE plots ADD COLUMN IF NOT EXISTS lot_lng DOUBLE PRECISION;
