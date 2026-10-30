-- Account deletion asked from the public page (/suppression-compte) by
-- someone who can't sign in any more: their e-mail and username, kept until
-- the team handles it on /admin (« Suppressions »): the account found and
-- deleted (account.Delete), or the request closed (nothing found, not theirs).
CREATE TABLE IF NOT EXISTS deletion_requests (
    id         BIGSERIAL PRIMARY KEY,
    email      TEXT NOT NULL,
    username   TEXT NOT NULL DEFAULT '',
    note       TEXT NOT NULL DEFAULT '',
    status     TEXT NOT NULL DEFAULT 'open', -- 'open' | 'done' | 'closed'
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    done_at    TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS deletion_requests_open ON deletion_requests (created_at) WHERE status = 'open';
