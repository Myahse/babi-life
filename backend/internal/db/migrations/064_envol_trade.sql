-- L'Envol and Babi Trade (sims/envol.go, sims/trade.go), in Babi Casino.
-- A bet on a round of L'Envol: cashed in by hand, or by itself at its target, or lost when the plane flies off.
CREATE TABLE envol_bets (
    id         BIGSERIAL PRIMARY KEY,
    sim        UUID NOT NULL REFERENCES sims(id) ON DELETE CASCADE,
    round      BIGINT NOT NULL,
    stake      INT NOT NULL,
    auto       INT NOT NULL DEFAULT 0,      -- the multiplier × 100 it cashes in at by itself (0: by hand)
    cashed     INT NOT NULL DEFAULT 0,      -- the multiplier × 100 it was cashed in at (0: not)
    settles_at BIGINT NOT NULL,             -- unix seconds: the plane has flown off
    status     TEXT NOT NULL DEFAULT 'open', -- 'open' | 'won' | 'lost'
    payout     INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (sim, round)
);
CREATE INDEX envol_bets_round_idx ON envol_bets (round);
CREATE INDEX envol_bets_sim_idx ON envol_bets (sim, status, settles_at);

-- A call on Babi Trade: up or down, from its entry to its expiry.
CREATE TABLE trade_bets (
    id          BIGSERIAL PRIMARY KEY,
    sim         UUID NOT NULL REFERENCES sims(id) ON DELETE CASCADE,
    asset       TEXT NOT NULL,
    dir         TEXT NOT NULL,              -- 'hausse' | 'baisse'
    stake       INT NOT NULL,
    entry_at    BIGINT NOT NULL,            -- unix seconds
    entry_price DOUBLE PRECISION NOT NULL,
    expiry_at   BIGINT NOT NULL,
    exit_price  DOUBLE PRECISION,
    status      TEXT NOT NULL DEFAULT 'open', -- 'open' | 'won' | 'lost' | 'tie'
    payout      INT NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX trade_bets_sim_idx ON trade_bets (sim, status, expiry_at);
