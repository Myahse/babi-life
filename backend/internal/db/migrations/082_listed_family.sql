-- « Retrouver ma famille de la liste »: the player answered the offer (yes or
-- no), so it is never made again.
ALTER TABLE sims ADD COLUMN listed_answered BOOLEAN NOT NULL DEFAULT false;
