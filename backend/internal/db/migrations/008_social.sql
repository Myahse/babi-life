-- Friends, the street gang and the police record.
ALTER TABLE sims
    ADD COLUMN friends JSONB NOT NULL DEFAULT '[]',
    ADD COLUMN gang TEXT NOT NULL DEFAULT '',     -- '' | 'invited' | 'member' | 'left'
    ADD COLUMN record INT NOT NULL DEFAULT 0;     -- times arrested
