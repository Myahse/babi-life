-- « Mes limites » at the casino (sims/limits.go): what a player allows themselves, per account.
-- daily: the most they stake a day over all the money games (0: no limit); a higher one (or none) waits
-- in pending until pending_at, 24 hours on; pause_until: no money game until then.
CREATE TABLE IF NOT EXISTS casino_limits (
  user_id     UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  daily       INTEGER NOT NULL DEFAULT 0,
  pending     INTEGER,
  pending_at  TIMESTAMPTZ,
  pause_until TIMESTAMPTZ,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
