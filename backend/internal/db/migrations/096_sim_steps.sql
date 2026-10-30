-- A child's « étapes » (update « grandir-par-etapes », sims/grandir.go): each one once,
-- recorded even while the update is closed so a child already on its way keeps what it did.
CREATE TABLE IF NOT EXISTS sim_steps (
  sim_id UUID NOT NULL REFERENCES sims(id) ON DELETE CASCADE,
  id TEXT NOT NULL,
  at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (sim_id, id)
);
