-- Les rendez-vous de la semaine (update « rendez-vous », game/rendezvous.go, sims/rendezvous.go).
-- The schedule itself is code (a pure function of the clock); here only what changes.

-- The team's switch per rendez-vous (admin): off, it isn't held (no card, no post, no bonus).
CREATE TABLE IF NOT EXISTS rendezvous_settings (
    id         TEXT PRIMARY KEY,
    off        BOOLEAN NOT NULL DEFAULT false,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Who said « J'y serai » (remind) and who went (joined_at), per occurrence (« dames-samedi:20261114 »).
-- reminded_at: the notification sent, set by the one UPDATE that sends it (several servers send it once).
CREATE TABLE IF NOT EXISTS rendezvous_joins (
    occ         TEXT NOT NULL,
    sim         UUID NOT NULL REFERENCES sims(id) ON DELETE CASCADE,
    remind      BOOLEAN NOT NULL DEFAULT false,
    joined_at   TIMESTAMPTZ,
    reminded_at TIMESTAMPTZ,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (occ, sim)
);
CREATE INDEX IF NOT EXISTS rendezvous_joins_remind ON rendezvous_joins (occ) WHERE remind AND reminded_at IS NULL;

-- The Saturday dames tournament's wins, per opponent (a player's Sim id, or 'npc'), so a pair counts a few times at most.
CREATE TABLE IF NOT EXISTS rendezvous_wins (
    occ     TEXT NOT NULL,
    sim     UUID NOT NULL REFERENCES sims(id) ON DELETE CASCADE,
    against TEXT NOT NULL,
    n       INT NOT NULL DEFAULT 0,
    last_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (occ, sim, against)
);

-- What's done once whatever the servers: a pot paid (« prix:<occ> »), a bonus given (« foot:<occ>:<user> »).
CREATE TABLE IF NOT EXISTS rendezvous_done (
    key TEXT PRIMARY KEY,
    at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
