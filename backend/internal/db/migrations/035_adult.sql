-- Romance (a partner, « passer la nuit », fade to black) is for adults only:
-- the account says once that its player is 18 or over.
ALTER TABLE users ADD COLUMN IF NOT EXISTS adult_at TIMESTAMPTZ;
