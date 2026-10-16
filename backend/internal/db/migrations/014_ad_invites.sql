-- Babi Pub's send links: an advertiser talks to Babi Life first (WhatsApp,
-- e-mail, social networks); once agreed, the admin makes a link that lets
-- them send one ad. Without one, nothing can be uploaded.
CREATE TABLE ad_invites (
    code        TEXT PRIMARY KEY,
    label       TEXT NOT NULL DEFAULT '',  -- who it's for, as the admin wrote it
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    used_at     TIMESTAMPTZ,
    campaign_id UUID REFERENCES ad_campaigns(id) ON DELETE SET NULL
);
