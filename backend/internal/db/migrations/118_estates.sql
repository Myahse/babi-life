-- Buildings that pay (sims/estate.go, the update « immobilier »): an apartment block, the same with a shop,
-- a tower of offices, each on one of a player's lots. Its tenants, its upkeep, the shop and its staff, and
-- the money waiting for its owner, moved on to `last` (hours counted of the day running: tenants come and
-- go once a day).
CREATE TABLE IF NOT EXISTS estates (
    plot_id   BIGINT PRIMARY KEY REFERENCES plots(id) ON DELETE CASCADE,
    sim_id    UUID NOT NULL REFERENCES sims(id) ON DELETE CASCADE,
    plan      TEXT NOT NULL,
    kind      TEXT NOT NULL,
    units     INT NOT NULL,
    tenants   INT NOT NULL DEFAULT 0,
    upkeep    REAL NOT NULL DEFAULT 100,
    shop      TEXT NOT NULL DEFAULT '',
    staff     JSONB NOT NULL DEFAULT '[]',
    pending   INT NOT NULL DEFAULT 0,
    hours     INT NOT NULL DEFAULT 0,
    last      TIMESTAMPTZ NOT NULL DEFAULT now(),
    collected BIGINT NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS estates_sim ON estates (sim_id);
