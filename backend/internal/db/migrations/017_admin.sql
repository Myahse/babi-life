-- The admin space: what the team did (sent an announcement, a WhatsApp
-- campaign…), the announcements to every Sim, the WhatsApp campaigns with
-- each number's result, and the numbers that asked not to be written to.
CREATE TABLE admin_log (
    id         BIGSERIAL PRIMARY KEY,
    action     TEXT NOT NULL,
    detail     TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE announcements (
    id         BIGSERIAL PRIMARY KEY,
    text       TEXT NOT NULL,
    reached    INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE wa_campaigns (
    id         BIGSERIAL PRIMARY KEY,
    template   TEXT NOT NULL,
    lang       TEXT NOT NULL,
    audience   TEXT NOT NULL,           -- 'liste' | 'beta'
    total      INT NOT NULL DEFAULT 0,
    sent       INT NOT NULL DEFAULT 0,
    failed     INT NOT NULL DEFAULT 0,
    status     TEXT NOT NULL DEFAULT 'running', -- 'running' | 'done' | 'stopped'
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE wa_sends (
    campaign BIGINT NOT NULL REFERENCES wa_campaigns(id) ON DELETE CASCADE,
    contact  TEXT NOT NULL,
    status   TEXT NOT NULL DEFAULT 'queued', -- 'queued' | 'sent' | 'failed'
    error    TEXT NOT NULL DEFAULT '',
    sent_at  TIMESTAMPTZ,
    PRIMARY KEY (campaign, contact)
);

CREATE TABLE wa_optout (
    contact    TEXT PRIMARY KEY,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
