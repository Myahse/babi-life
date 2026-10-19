-- A Sim the testers' toolbox was used on (with the code alone, on an account
-- that isn't a tester's): reset with the testers' accounts (POST /admin/testers/reset).
ALTER TABLE sims ADD COLUMN tested BOOLEAN NOT NULL DEFAULT false;
