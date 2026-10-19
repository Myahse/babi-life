-- The phone's gallery: the photos and selfies a Sim takes with its camera.
-- The picture is in the bucket (key) when one is set up, else here (image).
CREATE TABLE photos (
    id         BIGSERIAL PRIMARY KEY,
    sim        UUID NOT NULL REFERENCES sims(id) ON DELETE CASCADE,
    key        TEXT NOT NULL DEFAULT '',
    image      BYTEA,
    mime       TEXT NOT NULL,
    kind       TEXT NOT NULL DEFAULT 'photo', -- 'photo' | 'selfie'
    place      TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX photos_sim_idx ON photos (sim, created_at DESC);
