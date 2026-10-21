-- Two players together (sims/couple.go): asked by one, accepted by the
-- other, between friends whose accounts and Sims are adults. One couple of
-- players at a time each; either can break it off.
ALTER TABLE bonds ADD COLUMN couple BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE couple_requests (
  from_sim   UUID NOT NULL REFERENCES sims(id) ON DELETE CASCADE,
  to_sim     UUID NOT NULL REFERENCES sims(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (from_sim, to_sim)
);
CREATE INDEX couple_requests_to_idx ON couple_requests (to_sim);
