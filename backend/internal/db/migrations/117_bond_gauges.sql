-- Relationships between players (sims/vie.go, the update « mode-vie »): beside the friendship gauge, a
-- romance gauge, and whether they've fallen out (enemies). Couples already together start with a high
-- romance.
ALTER TABLE bonds ADD COLUMN IF NOT EXISTS romance INT NOT NULL DEFAULT 0;
ALTER TABLE bonds ADD COLUMN IF NOT EXISTS enemy BOOLEAN NOT NULL DEFAULT false;
UPDATE bonds SET romance = 70 WHERE couple AND romance = 0;
