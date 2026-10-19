-- The ground of a house built from a plan (game/plans.go): the floor of each
-- room, the garden, the terrace, the pool. [[x, z, w, d, "kind", "label"], …]
ALTER TABLE plots ADD COLUMN zones JSONB NOT NULL DEFAULT '[]';
