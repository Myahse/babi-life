-- Les papiers (update « papiers », sims/papiers.go): the game's own documents of a Sim.
-- One live document per (sim, kind, ref): ref is what it's about (a career, a lot's id, a
-- vehicle's id, a spouse; '' for the one-of-a-kind ones), so issuing it again is idempotent.
-- number: the game's format (« BL-2026-000123 »), from the sequence. ended: the job left, the lot
-- sold, the vehicle sold (kept, marked). legalised: a copy legalised at the mairie or the préfecture.
CREATE SEQUENCE IF NOT EXISTS documents_number;
CREATE TABLE IF NOT EXISTS documents (
    id         BIGSERIAL PRIMARY KEY,
    sim_id     UUID NOT NULL REFERENCES sims(id) ON DELETE CASCADE,
    kind       TEXT NOT NULL,
    ref        TEXT NOT NULL DEFAULT '',
    number     TEXT NOT NULL UNIQUE,
    data       JSONB NOT NULL DEFAULT '{}',
    legalised  BOOLEAN NOT NULL DEFAULT false,
    ended      BOOLEAN NOT NULL DEFAULT false,
    issued_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ,
    UNIQUE (sim_id, kind, ref)
);
