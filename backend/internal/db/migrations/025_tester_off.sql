-- An account the testers' reset made an ordinary player again: the code kept
-- in its browser no longer makes it a tester (only /admin can).
ALTER TABLE users ADD COLUMN tester_off BOOLEAN NOT NULL DEFAULT false;
