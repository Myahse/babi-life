-- Mon quartier's ground, shaped by its owner (game/terrain.go, sims/monquartier.go quartierTerrain): the cells of
-- 8 m it laid a road on, dug water in, made a bridge over water, planted a tree on, or cleared (« x,y,t;… »,
-- sorted). The phone lays them over the generated world (web world3d/quartier/univers/terrain.ts).
ALTER TABLE quartiers ADD COLUMN IF NOT EXISTS terrain TEXT NOT NULL DEFAULT '';
