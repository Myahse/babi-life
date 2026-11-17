-- Mon quartier as a neighbourhood of lots (sims/monquartier.go, game.QuartierLotSpot): a building's slot is now
-- its lot among the real streets round the home. layout: the version of the lots' places it was put at;
-- the v1 buildings (1: a ring of slots close round the home) are moved onto their lot (the same number) the
-- first time their quartier is read (migrateLots), where the server knows the lots' places.
ALTER TABLE quartier_buildings ADD COLUMN IF NOT EXISTS layout INT NOT NULL DEFAULT 1;
