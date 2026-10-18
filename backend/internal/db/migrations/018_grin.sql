-- Le grin: the public chat of Gbairai, one room for all of Babi and one per
-- commune. Messages are kept for a week; a report can hide one.
CREATE TABLE grin (
    id         BIGSERIAL PRIMARY KEY,
    room       TEXT NOT NULL,              -- 'babi' or the commune's id
    sim        UUID NOT NULL REFERENCES sims(id) ON DELETE CASCADE,
    body       TEXT NOT NULL,
    hidden     BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX grin_room_idx ON grin (room, id DESC);
CREATE INDEX grin_sim_idx ON grin (sim, created_at DESC);

ALTER TABLE reports ADD COLUMN grin_id BIGINT REFERENCES grin(id) ON DELETE SET NULL;
