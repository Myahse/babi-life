-- Babi Pub: the ads on the game's billboards, paid for and sent by the
-- advertisers (their file is in the bucket), and how often players saw them.
CREATE TABLE ad_campaigns (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    token      TEXT NOT NULL UNIQUE,            -- the advertiser's private follow-up link
    advertiser TEXT NOT NULL,
    contact    TEXT NOT NULL,                   -- e-mail or phone, to agree the price and the payment
    title      TEXT NOT NULL,
    media_key  TEXT NOT NULL,                   -- the file in the bucket
    media_type TEXT NOT NULL,                   -- 'image' | 'video'
    communes   TEXT[] NOT NULL DEFAULT '{}',    -- where it shows; empty: every commune
    starts     DATE NOT NULL,
    ends       DATE NOT NULL,
    status     TEXT NOT NULL DEFAULT 'pending', -- pending | approved | rejected | paused
    paid       BOOLEAN NOT NULL DEFAULT false,
    price      INTEGER NOT NULL DEFAULT 0,      -- FCFA, once agreed
    note       TEXT NOT NULL DEFAULT '',        -- for the advertiser: why refused, what to change
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Views, counted by the game: a campaign seen on a billboard of a commune, by day.
CREATE TABLE ad_views (
    campaign_id UUID NOT NULL REFERENCES ad_campaigns(id) ON DELETE CASCADE,
    commune     TEXT NOT NULL,
    day         DATE NOT NULL,
    views       INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (campaign_id, commune, day)
);
