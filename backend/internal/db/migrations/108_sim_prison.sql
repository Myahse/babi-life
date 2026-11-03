-- Prison at the MACA (game/prison.go, sims/prison.go): the sentence being lived, its « étapes » asked
-- and done; NULL when free.
ALTER TABLE sims ADD COLUMN IF NOT EXISTS prison JSONB;
