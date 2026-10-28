-- E-mails of news sent from /admin (admin/email.go), like the WhatsApp ones:
-- a campaign, each address it went to, and the addresses that asked to stop.
CREATE TABLE IF NOT EXISTS mail_campaigns (
    id         BIGSERIAL PRIMARY KEY,
    template   TEXT NOT NULL,
    subject    TEXT NOT NULL,
    audience   TEXT NOT NULL,           -- 'liste' | 'beta' | 'joueurs' | 'testeurs' | 'tous'
    total      INT NOT NULL DEFAULT 0,
    sent       INT NOT NULL DEFAULT 0,
    failed     INT NOT NULL DEFAULT 0,
    status     TEXT NOT NULL DEFAULT 'running', -- 'running' | 'done' | 'stopped'
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS mail_sends (
    campaign BIGINT NOT NULL REFERENCES mail_campaigns(id) ON DELETE CASCADE,
    email    TEXT NOT NULL,
    status   TEXT NOT NULL DEFAULT 'queued', -- 'sent' | 'failed'
    error    TEXT NOT NULL DEFAULT '',
    sent_at  TIMESTAMPTZ,
    PRIMARY KEY (campaign, email)
);

CREATE TABLE IF NOT EXISTS mail_optout (
    email      TEXT PRIMARY KEY, -- lower case
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
