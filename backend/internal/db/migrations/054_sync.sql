-- Played offline and synced (sims/sync.go): the latest step already counted (the phone's clock, ms),
-- so a sync sent again (its answer lost on a bad network) doesn't count it twice.
ALTER TABLE sims ADD COLUMN IF NOT EXISTS synced_at BIGINT NOT NULL DEFAULT 0;
