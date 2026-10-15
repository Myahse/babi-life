-- The Sim people make on the wish list, and the family it was born into:
-- kept for the day the game opens.
ALTER TABLE waitlist
    ADD COLUMN sim     JSONB,
    ADD COLUMN family  TEXT NOT NULL DEFAULT '',
    ADD COLUMN born_in TEXT NOT NULL DEFAULT ''; -- the commune's id
