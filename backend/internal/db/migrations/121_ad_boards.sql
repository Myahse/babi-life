-- A campaign's own file for the narrow billboards (ads/ads.go): the sucette (portrait, 2:3) and the banderole
-- (a long strip, about 6:1), beside its main file. Empty: the main file there too, cropped to the middle.
ALTER TABLE ad_campaigns ADD COLUMN IF NOT EXISTS sucette_key TEXT NOT NULL DEFAULT '';
ALTER TABLE ad_campaigns ADD COLUMN IF NOT EXISTS sucette_type TEXT NOT NULL DEFAULT '';
ALTER TABLE ad_campaigns ADD COLUMN IF NOT EXISTS banderole_key TEXT NOT NULL DEFAULT '';
ALTER TABLE ad_campaigns ADD COLUMN IF NOT EXISTS banderole_type TEXT NOT NULL DEFAULT '';
