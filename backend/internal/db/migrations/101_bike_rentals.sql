-- Vélo Babi (world/bikes.go, sims/bikes.go): the bike a Sim has hired, one at a time: the station it was
-- taken from, until when it's paid (then it locks), when it was taken. Back at its station (the row gone)
-- when returned, or by itself half an hour after its time ran out.
CREATE TABLE bike_rentals (
    sim_id     UUID PRIMARY KEY REFERENCES sims(id) ON DELETE CASCADE,
    dock       TEXT NOT NULL,
    until      TIMESTAMPTZ NOT NULL,
    started_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX bike_rentals_dock_idx ON bike_rentals (dock, until);
