-- La vitrine des panneaux (the update « pub-vitrine »): a player taps a board, the advertiser's showcase
-- opens; the taps counted by campaign, commune and day, beside the views.
ALTER TABLE ad_views ADD COLUMN IF NOT EXISTS clicks INT NOT NULL DEFAULT 0;
