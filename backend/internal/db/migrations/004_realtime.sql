-- The game now runs on real Abidjan time: game_minutes = real minutes since
-- 2024-01-01 00:00 UTC (a Monday). Existing Sims are moved onto that clock
-- at the moment they were last seen, so no Saturday is charged twice.
UPDATE sims SET game_minutes = floor(extract(epoch FROM (last_tick - TIMESTAMPTZ '2024-01-01 00:00:00+00')) / 60);

-- What the Sim is busy with (an activity or a trip), NULL when free.
ALTER TABLE sims ADD COLUMN activity JSONB;
