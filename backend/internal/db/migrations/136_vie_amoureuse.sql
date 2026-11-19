-- La vie amoureuse (the update « vie-amoureuse », sims/amour.go, game/amour.go): a couple of players keeps
-- its stage, since when, when it was last tended (the love decays on read, never by a ticker), the
-- anniversaries already said and, later, the home shared. Existing couples start « ensemble » today.
ALTER TABLE bonds ADD COLUMN IF NOT EXISTS love_stage TEXT NOT NULL DEFAULT '';
ALTER TABLE bonds ADD COLUMN IF NOT EXISTS love_since TIMESTAMPTZ;
ALTER TABLE bonds ADD COLUMN IF NOT EXISTS love_tended TIMESTAMPTZ;
ALTER TABLE bonds ADD COLUMN IF NOT EXISTS anniv_seen INT NOT NULL DEFAULT 0;
ALTER TABLE bonds ADD COLUMN IF NOT EXISTS shared_home UUID REFERENCES sims(id) ON DELETE SET NULL;
UPDATE bonds SET love_stage = 'ensemble', love_since = COALESCE(seen_at, now()), love_tended = now() WHERE couple AND love_stage = '';

-- A step up asked of the other player (phase 2: officiel, fiancés…): consent for each one.
CREATE TABLE IF NOT EXISTS love_requests (
    from_sim   UUID NOT NULL REFERENCES sims(id) ON DELETE CASCADE,
    to_sim     UUID NOT NULL REFERENCES sims(id) ON DELETE CASCADE,
    kind       TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (from_sim, to_sim, kind)
);
CREATE INDEX IF NOT EXISTS love_requests_to_idx ON love_requests (to_sim);

-- A gift between players (phase 2), wrapped until opened.
CREATE TABLE IF NOT EXISTS love_gifts (
    id         BIGSERIAL PRIMARY KEY,
    from_sim   UUID NOT NULL REFERENCES sims(id) ON DELETE CASCADE,
    to_sim     UUID NOT NULL REFERENCES sims(id) ON DELETE CASCADE,
    item       TEXT NOT NULL,
    note       TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    opened_at  TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS love_gifts_unopened_idx ON love_gifts (to_sim) WHERE opened_at IS NULL;

-- The thread with a partner met in the game (« Mon cœur »): their « Bonjour mon cœur », the mots doux sent.
CREATE TABLE IF NOT EXISTS partner_messages (
    id         BIGSERIAL PRIMARY KEY,
    sim_id     UUID NOT NULL REFERENCES sims(id) ON DELETE CASCADE,
    friend     TEXT NOT NULL,
    mine       BOOLEAN NOT NULL DEFAULT false,
    body       TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    read_at    TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS partner_messages_thread_idx ON partner_messages (sim_id, friend, id);
