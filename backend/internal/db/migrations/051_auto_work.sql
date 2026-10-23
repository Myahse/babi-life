-- Going to work by oneself as the shift's hours come (sims/jobs.go), the
-- Boulot app's switch: the Sim starts its shift at its workplace in the commune.
ALTER TABLE sims ADD COLUMN IF NOT EXISTS auto_work BOOLEAN NOT NULL DEFAULT false;
