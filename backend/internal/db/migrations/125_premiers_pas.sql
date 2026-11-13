-- The admin's « Nouveaux joueurs » (admin/nouveaux.go): where new players drop off. The steps the server
-- can't see on its own (in the 3D street, the Sim moved) go in user_funnel like the tutorial's (auth/funnel.go,
-- one row per account and step); here, the last screen a new account saw in its first days (nothing else
-- about the player: a screen's name and when), to tell where the ones who never came back left.
CREATE TABLE IF NOT EXISTS user_last_screen (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    screen  TEXT NOT NULL,
    at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- The first message a player wrote (the funnel's « premier message »), found by who sent it.
CREATE INDEX IF NOT EXISTS messages_from_idx ON messages (from_sim);
