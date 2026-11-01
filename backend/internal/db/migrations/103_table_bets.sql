-- La table de l'Ivoire (sims/table.go): the shared roulette's bets, one set a player a round.
CREATE TABLE IF NOT EXISTS table_bets (
  id         BIGSERIAL PRIMARY KEY,
  sim        UUID NOT NULL REFERENCES sims(id) ON DELETE CASCADE,
  round      BIGINT NOT NULL,
  bets       JSONB NOT NULL,
  stake      INTEGER NOT NULL,
  payout     INTEGER NOT NULL DEFAULT 0,
  status     TEXT NOT NULL DEFAULT 'open',
  settles_at BIGINT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (sim, round)
);
CREATE INDEX IF NOT EXISTS table_bets_round_idx ON table_bets (round);
CREATE INDEX IF NOT EXISTS table_bets_open_idx ON table_bets (sim) WHERE status = 'open';
