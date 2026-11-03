-- The tutorial's funnel (auth/funnel.go, the admin's « Le parcours des nouveaux »): each step an account
-- passed, once, and when: the tutorial started, finished or skipped, the first activity finished after it.
-- And how many separate times the game was played (a pause of half an hour starts a new one).
CREATE TABLE IF NOT EXISTS user_funnel (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    step    TEXT NOT NULL,
    at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, step)
);
ALTER TABLE users ADD COLUMN IF NOT EXISTS play_sessions INT NOT NULL DEFAULT 0;
