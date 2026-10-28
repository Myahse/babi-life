-- The game's own account (« Babi Life »), set from the admin: the testers' toolbox
-- for good (never undone by the testers' reset) and a badge by its name.
ALTER TABLE users ADD COLUMN official BOOLEAN NOT NULL DEFAULT false;
