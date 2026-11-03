-- Les braquages (game/braquage.go, sims/braquage.go): a Sim's bank job in preparation (the bank
-- scouted, the real day it was, the gear ready) and how long it stays wanted after a job got away with.
CREATE TABLE IF NOT EXISTS sim_braquages (
    sim_id       UUID PRIMARY KEY REFERENCES sims(id) ON DELETE CASCADE,
    bank         TEXT NOT NULL DEFAULT '',
    scouted_day  BIGINT NOT NULL DEFAULT -1,
    prepared     BOOLEAN NOT NULL DEFAULT false,
    wanted_until BIGINT NOT NULL DEFAULT 0
);
