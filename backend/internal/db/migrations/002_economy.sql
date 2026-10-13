-- Where a Sim started in life, where they live and what they do for a living.
ALTER TABLE sims
    ADD COLUMN origin       TEXT    NOT NULL DEFAULT 'debrouillard',
    ADD COLUMN housing      TEXT    NOT NULL DEFAULT 'studio',
    ADD COLUMN loan         INTEGER NOT NULL DEFAULT 0,   -- FCFA owed to the microfinance
    ADD COLUMN rent_arrears INTEGER NOT NULL DEFAULT 0,   -- FCFA of unpaid rent
    ADD COLUMN career       TEXT    NOT NULL DEFAULT '',  -- '' = no job
    ADD COLUMN career_level INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN performance  INTEGER NOT NULL DEFAULT 0;
