-- Bets on the virtual football (Bet225, ParisFoot): a bet, single or
-- combined, and its legs. Settled when its last match is over.
CREATE TABLE bets (
    id         BIGSERIAL PRIMARY KEY,
    sim        UUID NOT NULL REFERENCES sims(id) ON DELETE CASCADE,
    app        TEXT NOT NULL,
    stake      INT NOT NULL,
    odds       NUMERIC(10, 2) NOT NULL,
    status     TEXT NOT NULL DEFAULT 'open', -- 'open' | 'won' | 'lost'
    payout     INT NOT NULL DEFAULT 0,
    settles_at BIGINT NOT NULL,              -- unix seconds: when its last match ends
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX bets_sim_idx ON bets (sim, id DESC);
CREATE INDEX bets_open_idx ON bets (sim, status, settles_at);

CREATE TABLE bet_legs (
    bet   BIGINT NOT NULL REFERENCES bets(id) ON DELETE CASCADE,
    match TEXT NOT NULL,   -- "round:i"
    label TEXT NOT NULL,   -- « Babi Sporting – Yop City FC »
    pick  TEXT NOT NULL,
    odds  NUMERIC(10, 2) NOT NULL,
    PRIMARY KEY (bet, match)
);
