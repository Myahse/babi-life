-- Les animaux (the update « animaux », sims/animaux.go, game/animaux.go): a Sim's own animals, one of each
-- kind. hunger, spirits: out of 100, brought down with the real hours when read (updated); hungry0: since
-- when its hunger is at 0 (a day of it and it runs off: away); eggs, egg_at: the hens' eggs laid; fed_days,
-- fed_on: the days it was fed (the sheep's weight); done: when each act was last done (cooldowns).
CREATE TABLE IF NOT EXISTS pets (
    id       BIGSERIAL PRIMARY KEY,
    sim_id   UUID NOT NULL REFERENCES sims(id) ON DELETE CASCADE,
    kind     TEXT NOT NULL,
    name     TEXT NOT NULL,
    hunger   REAL NOT NULL DEFAULT 80,
    spirits  REAL NOT NULL DEFAULT 80,
    bond     INT NOT NULL DEFAULT 10,
    away     TIMESTAMPTZ,
    hungry0  TIMESTAMPTZ,
    eggs     INT NOT NULL DEFAULT 0,
    egg_at   TIMESTAMPTZ,
    fed_days INT NOT NULL DEFAULT 0,
    fed_on   DATE,
    done     JSONB NOT NULL DEFAULT '{}',
    since    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated  TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (sim_id, kind)
);
