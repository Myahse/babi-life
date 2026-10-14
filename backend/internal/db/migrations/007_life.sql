-- Sims are now born: a birth date (game minute) and the family they were born
-- into. Sims made before have no birth date and stay adults.
ALTER TABLE sims
    ADD COLUMN born_at BIGINT NOT NULL DEFAULT 0,
    ADD COLUMN family TEXT NOT NULL DEFAULT '';
