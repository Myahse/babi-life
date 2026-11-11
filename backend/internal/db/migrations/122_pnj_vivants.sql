-- Les PNJ vivants (update « pnj-vivants », sims/pnjvivants.go): the game's PNJ players talk in the grin
-- like players. Their messages have no Sim: pnj is the PNJ's id (« ia-<commune>-<n> »), pnj_name its first
-- name, and pnj_key what the line is for (an answer to a message, a quiet room's slot), unique, so
-- however many servers look at once each line is written once.
ALTER TABLE grin ADD COLUMN IF NOT EXISTS pnj TEXT;
ALTER TABLE grin ADD COLUMN IF NOT EXISTS pnj_name TEXT;
ALTER TABLE grin ADD COLUMN IF NOT EXISTS pnj_key TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS grin_pnj_key ON grin (pnj_key);
