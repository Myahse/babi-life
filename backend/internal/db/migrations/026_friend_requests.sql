-- Being friends is asked and accepted now: greeting someone in the street only
-- makes them someone the Sim knows (a bond). Everyone who already had a bond
-- stays friends, as before.
ALTER TABLE bonds ADD COLUMN friends BOOLEAN NOT NULL DEFAULT false;
UPDATE bonds SET friends = true;

CREATE TABLE friend_requests (
  from_sim   UUID NOT NULL REFERENCES sims(id) ON DELETE CASCADE,
  to_sim     UUID NOT NULL REFERENCES sims(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (from_sim, to_sim)
);
CREATE INDEX friend_requests_to_idx ON friend_requests (to_sim);
