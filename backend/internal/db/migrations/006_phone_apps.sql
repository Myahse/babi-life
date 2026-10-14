-- Apps installed on the Sim's phone (from the in-game store). Waye, the
-- mobile money app, comes with the phone.
ALTER TABLE sims ADD COLUMN apps TEXT[] NOT NULL DEFAULT '{waye}';
