-- Notification campaigns from /admin (« Notifications », admin/notify.go): a
-- title, a text, an optional picture and link, to an audience, sent in the
-- background one player at a time, followed live and stoppable. An update
-- opened with « Prévenir les joueurs » goes the same way (source 'maj:<id>').
-- Tests (to one account) are kept too: they count in their own daily limit.
CREATE TABLE push_campaigns (
    id         BIGSERIAL PRIMARY KEY,
    title      TEXT NOT NULL,
    body       TEXT NOT NULL,
    image      TEXT NOT NULL DEFAULT '',
    url        TEXT NOT NULL DEFAULT '',
    audience   TEXT NOT NULL,
    detail     TEXT NOT NULL DEFAULT '',   -- the commune, or the days of « actifs »
    source     TEXT NOT NULL DEFAULT 'admin',
    test       BOOLEAN NOT NULL DEFAULT false,
    total      INT NOT NULL DEFAULT 0,      -- players
    sent       INT NOT NULL DEFAULT 0,      -- players reached on at least one phone or browser
    failed     INT NOT NULL DEFAULT 0,      -- players reached nowhere
    devices    INT NOT NULL DEFAULT 0,      -- phones and browsers reached
    status     TEXT NOT NULL DEFAULT 'running', -- 'running' | 'done' | 'stopped'
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX push_campaigns_day_idx ON push_campaigns (created_at);

-- The pictures and videos the campaigns carry (e-mails and notifications), in
-- the same bucket as Babi Pub's files (under campagnes/). A video's page on the
-- site (/video/<id>) reads it here: e-mails can't play videos, they link to it.
CREATE TABLE campaign_media (
    id         TEXT PRIMARY KEY,
    kind       TEXT NOT NULL,              -- 'image' | 'video'
    url        TEXT NOT NULL,
    poster     TEXT NOT NULL DEFAULT '',
    title      TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
