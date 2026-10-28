-- The game minute the mentor last gave a hand (game/mentor.go): once a game week at most.
ALTER TABLE sims ADD COLUMN IF NOT EXISTS mentor_help BIGINT NOT NULL DEFAULT 0;
