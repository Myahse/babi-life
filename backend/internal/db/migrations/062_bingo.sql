-- Babi Bingo (game/bingo.go, sims/bingo.go): the cards bought for a draw of
-- one of the games, settled once its last ball is out.
CREATE TABLE bingo_cards (
    id         BIGSERIAL PRIMARY KEY,
    sim        UUID NOT NULL REFERENCES sims(id) ON DELETE CASCADE,
    game       TEXT NOT NULL,
    draw       BIGINT NOT NULL,
    numbers    INT[] NOT NULL,         -- row by row, 0 for a blank cell or the free middle
    stake      INT NOT NULL,
    settles_at BIGINT NOT NULL,        -- unix seconds: the draw's last ball
    status     TEXT NOT NULL DEFAULT 'open', -- 'open' | 'won' | 'lost'
    prize      TEXT NOT NULL DEFAULT '',
    payout     INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX bingo_cards_sim_idx ON bingo_cards (sim, status, settles_at);
CREATE INDEX bingo_cards_draw_idx ON bingo_cards (game, draw);
