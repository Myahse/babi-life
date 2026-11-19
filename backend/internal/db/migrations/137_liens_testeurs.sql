-- Links the team sets in /admin and the game shows (admin/liens.go): the Google group of the Android app's testers and
-- the Play Store's « become a tester » page (update « testeurs-android »: the card asking players to test the app).
CREATE TABLE IF NOT EXISTS team_links (
    id         TEXT PRIMARY KEY,
    url        TEXT NOT NULL DEFAULT '',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
