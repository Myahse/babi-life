-- A campaign's own file for each app (ads/ads.go): Tikitoko's full-screen slide (9:16) and Babigram's post
-- (4:5), beside its main file (the billboards'). Empty: the main file there too.
ALTER TABLE ad_campaigns ADD COLUMN IF NOT EXISTS tiki_key TEXT NOT NULL DEFAULT '';
ALTER TABLE ad_campaigns ADD COLUMN IF NOT EXISTS tiki_type TEXT NOT NULL DEFAULT '';
ALTER TABLE ad_campaigns ADD COLUMN IF NOT EXISTS gram_key TEXT NOT NULL DEFAULT '';
ALTER TABLE ad_campaigns ADD COLUMN IF NOT EXISTS gram_type TEXT NOT NULL DEFAULT '';
