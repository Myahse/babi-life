-- Mon quartier as its own world (game/univers.go, web world3d/quartier/univers/): no longer a piece of the real map
-- round the home but a whole neighbourhood generated on every phone from a seed and its commune's style (preset),
-- in the layout the player picked (variant) at the first visit (chosen). The buildings keep their lot's number;
-- the older layouts' (v1, v2: places on the real map) move into the world when their quartier is read (layout 3).
ALTER TABLE quartiers ADD COLUMN IF NOT EXISTS seed BIGINT;
ALTER TABLE quartiers ADD COLUMN IF NOT EXISTS preset TEXT;
ALTER TABLE quartiers ADD COLUMN IF NOT EXISTS variant INT NOT NULL DEFAULT 0;
ALTER TABLE quartiers ADD COLUMN IF NOT EXISTS chosen BOOLEAN NOT NULL DEFAULT false;
