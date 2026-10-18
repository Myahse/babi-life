-- Loto Chance tickets, bought at a street kiosk: 1 to 3 numbers on a draw.
CREATE TABLE loto_tickets (
    id         BIGSERIAL PRIMARY KEY,
    sim        UUID NOT NULL REFERENCES sims(id) ON DELETE CASCADE,
    draw       BIGINT NOT NULL,         -- unix seconds of the draw
    numbers    INT[] NOT NULL,
    stake      INT NOT NULL,
    status     TEXT NOT NULL DEFAULT 'open', -- 'open' | 'won' | 'lost'
    payout     INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX loto_sim_idx ON loto_tickets (sim, status, draw);
