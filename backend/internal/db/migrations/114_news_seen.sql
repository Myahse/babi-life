-- The « NOUVEAU » cards an account has seen (auth/newsseen.go): kept with the account, not on the
-- phone, so a card read once isn't shown again on the next sign-in or another device.
CREATE TABLE IF NOT EXISTS user_news_seen (
    user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    feature_id TEXT NOT NULL,
    seen_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, feature_id)
);
