-- The app put away (closed, sent to the background): when (sims/clock.go). From
-- then the Sim's life is on hold until it's played again; nothing advances meanwhile.
ALTER TABLE sims ADD COLUMN IF NOT EXISTS paused_at TIMESTAMPTZ;
