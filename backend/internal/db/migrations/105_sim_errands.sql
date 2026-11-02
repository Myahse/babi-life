-- The quartier's demandes (game/errands.go): a Sim's for each real day, how far each has come
-- (the step it's at, and when it was done).
CREATE TABLE IF NOT EXISTS sim_errands (
    sim_id    UUID NOT NULL REFERENCES sims(id) ON DELETE CASCADE,
    day       BIGINT NOT NULL,
    errand_id TEXT NOT NULL,
    slot      INTEGER NOT NULL,
    step      INTEGER NOT NULL DEFAULT 0,
    done_at   TIMESTAMPTZ,
    PRIMARY KEY (sim_id, day, errand_id)
);
