-- Mon quartier (sims/monquartier.go, the update « mon-quartier »): each Sim's own few streets around its
-- home, its level and reputation, who may visit. rep_at: up to when the open buildings' customers have
-- been counted into the reputation (moved on when the quartier is read: no background job).
CREATE TABLE IF NOT EXISTS quartiers (
    sim_id      UUID PRIMARY KEY REFERENCES sims(id) ON DELETE CASCADE,
    commune     TEXT NOT NULL,
    center_lat  DOUBLE PRECISION NOT NULL,
    center_lng  DOUBLE PRECISION NOT NULL,
    name        TEXT NOT NULL,
    level       INT NOT NULL DEFAULT 1,
    reputation  INT NOT NULL DEFAULT 0,
    visits_mode TEXT NOT NULL DEFAULT 'tous',
    pionnier    BOOLEAN NOT NULL DEFAULT false,
    rep_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Its buildings, each on one spot (slot) of the quartier's layout; the money waiting in it moved on to
-- `last` (whole hours).
CREATE TABLE IF NOT EXISTS quartier_buildings (
    id               BIGSERIAL PRIMARY KEY,
    sim_id           UUID NOT NULL REFERENCES quartiers(sim_id) ON DELETE CASCADE,
    kind             TEXT NOT NULL,
    slot             INT NOT NULL,
    lat              DOUBLE PRECISION NOT NULL,
    lng              DOUBLE PRECISION NOT NULL,
    heading          REAL NOT NULL DEFAULT 0,
    level            INT NOT NULL DEFAULT 1,
    staff            INT NOT NULL DEFAULT 0,
    opened           BOOLEAN NOT NULL DEFAULT true,
    earnings_pending INT NOT NULL DEFAULT 0,
    last             TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (sim_id, slot)
);

-- The players who came to visit: one a day each counts for the owner's reputation.
CREATE TABLE IF NOT EXISTS quartier_visits (
    owner   UUID NOT NULL REFERENCES sims(id) ON DELETE CASCADE,
    visitor UUID NOT NULL REFERENCES sims(id) ON DELETE CASCADE,
    day     BIGINT NOT NULL,
    PRIMARY KEY (owner, visitor, day)
);
