-- Soirées thrown by players at home (sims/party.go): the others in the
-- commune see them on the map and come. One at a time per host.
CREATE TABLE soirees (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    host_sim   UUID NOT NULL REFERENCES sims(id) ON DELETE CASCADE,
    city       TEXT NOT NULL,
    commune    TEXT NOT NULL,
    theme      TEXT NOT NULL,
    ends_at    TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX soirees_where ON soirees (city, commune, ends_at);
CREATE INDEX soirees_host ON soirees (host_sim, ends_at);

-- Who came (once each): the host is told of each new guest, the map shows how many.
CREATE TABLE soiree_guests (
    soiree_id  UUID NOT NULL REFERENCES soirees(id) ON DELETE CASCADE,
    sim_id     UUID NOT NULL REFERENCES sims(id) ON DELETE CASCADE,
    came_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (soiree_id, sim_id)
);
