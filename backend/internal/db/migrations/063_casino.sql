-- Babi Casino (sims/casino.go): the hand of le 21 a Sim is playing, its shoe and
-- the dealer's hidden card kept here, never sent before the hand is over.
CREATE TABLE blackjack_hands (
    sim        UUID PRIMARY KEY REFERENCES sims(id) ON DELETE CASCADE,
    hand       JSONB NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
