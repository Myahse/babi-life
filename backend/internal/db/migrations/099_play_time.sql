-- The time each account has spent in the game (auth Playing: the game page pings every minute while
-- it's on screen), shown on /admin and on the player's own profile.
ALTER TABLE users ADD COLUMN play_seconds BIGINT NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN play_seen_at TIMESTAMPTZ;
