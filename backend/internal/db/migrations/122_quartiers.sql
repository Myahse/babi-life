-- Mon quartier (game/quartier.go, sims/quartier.go): each Sim's own neighbourhood, a grid of cells (grass,
-- road, water, bridge, tree; its house, the way out, the billboards), and the requests of those who aren't
-- its friends to come in.
CREATE TABLE IF NOT EXISTS quartiers (
  sim_id     UUID PRIMARY KEY REFERENCES sims(id) ON DELETE CASCADE,
  grid       TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS quartier_requests (
  owner      UUID NOT NULL REFERENCES sims(id) ON DELETE CASCADE,
  from_sim   UUID NOT NULL REFERENCES sims(id) ON DELETE CASCADE,
  -- pending: waiting for the owner; ok: may come in (till the owner says otherwise).
  status     TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (owner, from_sim)
);
CREATE INDEX IF NOT EXISTS quartier_requests_from_idx ON quartier_requests (from_sim);
