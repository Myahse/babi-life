-- Babi Pub beyond the billboards: where an ad shows (the billboards, between
-- Tikitoko's videos, in Babigram's feed, as an app on the phone), its link
-- and, for the phone, the app's name and icon; the hour it starts on its
-- first day and ends on its last (minutes of the day, Abidjan time = UTC).
-- A send link can be revoked before it is used.
ALTER TABLE ad_campaigns
  ADD COLUMN places text[] NOT NULL DEFAULT '{panneaux}',
  ADD COLUMN link text NOT NULL DEFAULT '',
  ADD COLUMN app_name text NOT NULL DEFAULT '',
  ADD COLUMN icon_key text NOT NULL DEFAULT '',
  ADD COLUMN start_min int NOT NULL DEFAULT 0,
  ADD COLUMN end_min int NOT NULL DEFAULT 1440;
ALTER TABLE ad_invites ADD COLUMN revoked_at timestamptz;
