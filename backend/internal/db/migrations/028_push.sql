-- Where to send a player's notifications (internal/push): a browser's Web
-- Push subscription, or the Android app's Firebase token (in endpoint).
CREATE TABLE push_subs (
    id         BIGSERIAL PRIMARY KEY,
    user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    kind       TEXT NOT NULL,             -- 'web' | 'fcm'
    endpoint   TEXT NOT NULL UNIQUE,
    p256dh     TEXT NOT NULL DEFAULT '',
    auth       TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX push_subs_user_idx ON push_subs (user_id);

-- A bet whose matches are over has been told to its player.
ALTER TABLE bets ADD COLUMN notified BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX bets_due_idx ON bets (settles_at) WHERE status = 'open' AND NOT notified;
