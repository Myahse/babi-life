-- The jams regulated (update « circulation »): a street happening « Embouteillage » ended early
-- for everyone in that commune once a player at the junction played it well (sims jam.go). The
-- happening itself is a pure function of the clock (game.HappeningAt): only its early end is kept.
CREATE TABLE jams_cleared (
    city       TEXT NOT NULL,
    commune    TEXT NOT NULL,
    start      BIGINT NOT NULL,
    cleared_at BIGINT NOT NULL,
    sim_id     UUID REFERENCES sims(id) ON DELETE SET NULL,
    score      INT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (city, commune, start)
);
