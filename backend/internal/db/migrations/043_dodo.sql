-- Dodo (sims/dodo.go): the houses players let by the night, one listing a lot.
CREATE TABLE dodo_listings (
    id         BIGSERIAL PRIMARY KEY,
    sim_id     UUID NOT NULL REFERENCES sims(id) ON DELETE CASCADE,
    plot_id    BIGINT NOT NULL UNIQUE REFERENCES plots(id) ON DELETE CASCADE,
    title      TEXT NOT NULL,
    night      INT NOT NULL,
    stays      INT NOT NULL DEFAULT 0,
    earned     INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX dodo_listings_sim ON dodo_listings (sim_id);
