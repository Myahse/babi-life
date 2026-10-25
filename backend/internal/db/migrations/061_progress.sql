-- Experience, level and skills (game/progress.go): what playing builds up.
ALTER TABLE sims ADD COLUMN progress JSONB NOT NULL DEFAULT '{}'::jsonb;
