-- Gbairai, the phone's messaging app: messages between two players' Sims who
-- are friends (a row in bonds), the blocks, and the reports for moderation.
CREATE TABLE messages (
    id         BIGSERIAL PRIMARY KEY,
    from_sim   UUID NOT NULL REFERENCES sims(id) ON DELETE CASCADE,
    to_sim     UUID NOT NULL REFERENCES sims(id) ON DELETE CASCADE,
    body       TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    read_at    TIMESTAMPTZ
);
CREATE INDEX messages_to_idx ON messages (to_sim, created_at DESC);
CREATE INDEX messages_pair_idx ON messages (LEAST(from_sim, to_sim), GREATEST(from_sim, to_sim), id DESC);

CREATE TABLE blocks (
    sim        UUID NOT NULL REFERENCES sims(id) ON DELETE CASCADE,
    blocked    UUID NOT NULL REFERENCES sims(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (sim, blocked)
);

CREATE TABLE reports (
    id          BIGSERIAL PRIMARY KEY,
    reporter    UUID NOT NULL REFERENCES sims(id) ON DELETE CASCADE,
    reported    UUID NOT NULL REFERENCES sims(id) ON DELETE CASCADE,
    message_id  BIGINT REFERENCES messages(id) ON DELETE SET NULL,
    -- What was said, kept as it was when reported (the message can be deleted).
    excerpt     TEXT NOT NULL DEFAULT '',
    reason      TEXT NOT NULL,
    status      TEXT NOT NULL DEFAULT 'open', -- 'open' | 'done'
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX reports_open_idx ON reports (status, created_at DESC);
