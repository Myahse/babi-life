-- La boutique (shop/): Djai bought with real money through GeniusPay, by an
-- account of 18 or over. One line per purchase: the pack and its price as
-- sold (F CFA), GeniusPay's reference once the payment is made, its status
-- as GeniusPay last said it, and when the Djai were added to the Sim (once,
-- never twice: credited_at set in the same transaction as the money).
CREATE TABLE purchases (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    sim_id      UUID REFERENCES sims(id) ON DELETE SET NULL,
    pack        TEXT NOT NULL,
    price       INT NOT NULL,
    djai        INT NOT NULL,
    reference   TEXT UNIQUE,
    status      TEXT NOT NULL DEFAULT 'created',
    sandbox     BOOLEAN NOT NULL DEFAULT false,
    credited_at TIMESTAMPTZ,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX purchases_user ON purchases (user_id, created_at DESC);
-- The ones still waiting for GeniusPay's word (checked again now and then).
CREATE INDEX purchases_open ON purchases (created_at) WHERE credited_at IS NULL AND status IN ('pending', 'processing');
