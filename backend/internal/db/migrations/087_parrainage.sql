-- Inviting one's friends (update « parrainage »): each account's own short code
-- for its link (lifeinbabi.com/?p=code), given the first time it's asked; the
-- account whose link a new account signed up with (kept even while the update
-- is closed, never changed after); and the gifts the friends brought, wrapped
-- in the drawer until opened (sims/parrainage.go): one per friend, ever.
ALTER TABLE users ADD COLUMN ref_code TEXT UNIQUE;
ALTER TABLE users ADD COLUMN referred_by UUID REFERENCES users(id) ON DELETE SET NULL;
CREATE INDEX users_referred_by ON users (referred_by) WHERE referred_by IS NOT NULL;

CREATE TABLE referral_gifts (
    id          BIGSERIAL PRIMARY KEY,
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    friend_id   UUID UNIQUE REFERENCES users(id) ON DELETE SET NULL,
    friend_name TEXT NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    -- Once opened: by which Sim, and what was inside (kind: habit, frigo, deco, djai).
    opened_at   TIMESTAMPTZ,
    sim_id      UUID REFERENCES sims(id) ON DELETE SET NULL,
    kind        TEXT NOT NULL DEFAULT '',
    item        TEXT NOT NULL DEFAULT '',
    label       TEXT NOT NULL DEFAULT '',
    amount      INT NOT NULL DEFAULT 0,
    rare        BOOLEAN NOT NULL DEFAULT false
);
CREATE INDEX referral_gifts_user ON referral_gifts (user_id, created_at);
