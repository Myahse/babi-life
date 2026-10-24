-- What each account got by playing, per real day and per source (game/money.go):
-- the daily limits are read from here, for all the account's Sims together.
-- day: days since the game's Epoch (2024-01-01, Abidjan's midnight).
CREATE TABLE IF NOT EXISTS earnings (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    day     INT NOT NULL,
    kind    TEXT NOT NULL,
    amount  INT NOT NULL DEFAULT 0,
    times   INT NOT NULL DEFAULT 0,
    PRIMARY KEY (user_id, day, kind)
);
