-- The wish list: people who want to hear when Babi Life opens.
CREATE TABLE waitlist (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    first_name TEXT NOT NULL,
    contact    TEXT NOT NULL UNIQUE, -- an e-mail (lower case) or a phone number (digits, with +)
    kind       TEXT NOT NULL,        -- 'email' | 'phone'
    commune    TEXT NOT NULL DEFAULT '',
    beta       BOOLEAN NOT NULL DEFAULT false, -- wants to test before everyone
    source     TEXT NOT NULL DEFAULT '',       -- where they came from: 'flyer', 'video', …
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
