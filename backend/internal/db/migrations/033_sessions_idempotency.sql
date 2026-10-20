-- Each sign-in is a session: one device (a phone, a computer, the app). The
-- player sees them in their profile and can sign one out (auth/sessions.go).
CREATE TABLE sessions (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    device     TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_seen  TIMESTAMPTZ NOT NULL DEFAULT now(),
    revoked_at TIMESTAMPTZ
);
CREATE INDEX sessions_user_idx ON sessions (user_id, last_seen DESC);
-- Signing every other device out also ends the sessions from before there were sessions.
ALTER TABLE users ADD COLUMN tokens_after TIMESTAMPTZ;

-- A write sent twice (a double tap, a retry, a bad network) is done once: its
-- answer is kept a day under the key the app sent with it (auth/idempotency.go).
CREATE TABLE idempotency (
    user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    key        TEXT NOT NULL,
    request    TEXT NOT NULL,
    status     INT NOT NULL DEFAULT 0,
    body       BYTEA,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, key)
);
CREATE INDEX idempotency_old_idx ON idempotency (created_at);
