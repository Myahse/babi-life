CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE users (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    google_sub    TEXT UNIQUE,
    email         TEXT NOT NULL UNIQUE,
    name          TEXT NOT NULL,
    avatar_url    TEXT NOT NULL DEFAULT '',
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_login_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One player can own several Sims; the game currently plays the first one.
CREATE TABLE sims (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    first_name   TEXT NOT NULL,
    last_name    TEXT NOT NULL,
    gender       TEXT NOT NULL,
    look         JSONB NOT NULL,          -- skin, hair, outfit colours…
    traits       TEXT[] NOT NULL,
    aspiration   TEXT NOT NULL,
    home_city    TEXT NOT NULL,
    home_commune TEXT NOT NULL DEFAULT '',
    city         TEXT NOT NULL,           -- where the Sim is right now
    commune      TEXT NOT NULL DEFAULT '',
    money        INTEGER NOT NULL,        -- FCFA
    needs        JSONB NOT NULL,
    game_minutes BIGINT NOT NULL,         -- minutes since the start of day 1
    last_tick    TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX sims_user_id_idx ON sims(user_id);

-- The Sim's journal: interactions done and random things that happened.
CREATE TABLE sim_events (
    id         BIGSERIAL PRIMARY KEY,
    sim_id     UUID NOT NULL REFERENCES sims(id) ON DELETE CASCADE,
    kind       TEXT NOT NULL,             -- 'interaction' | 'random' | 'travel'
    text       TEXT NOT NULL,
    money      INTEGER NOT NULL DEFAULT 0,
    game_time  BIGINT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX sim_events_sim_id_idx ON sim_events(sim_id, id DESC);
