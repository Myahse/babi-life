-- Donations to Babi Life (shop/dons.go, the site's page /don): anyone, signed in or not, gives the sum they
-- like by card (Stripe) or Mobile Money (GeniusPay). Their name and message shown among the supporters when
-- they agree (public); the email only to thank them. reference: Stripe's Checkout Session or GeniusPay's payment.
CREATE TABLE IF NOT EXISTS donations (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    amount     INT NOT NULL,
    name       TEXT NOT NULL DEFAULT '',
    email      TEXT NOT NULL DEFAULT '',
    message    TEXT NOT NULL DEFAULT '',
    public     BOOLEAN NOT NULL DEFAULT true,
    method     TEXT NOT NULL,
    reference  TEXT UNIQUE,
    status     TEXT NOT NULL DEFAULT 'created',
    test       BOOLEAN NOT NULL DEFAULT false,
    paid_at    TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS donations_paid ON donations (paid_at DESC) WHERE paid_at IS NOT NULL;
