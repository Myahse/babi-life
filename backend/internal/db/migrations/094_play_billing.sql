-- The Android app's purchases through Google Play Billing (shop/play.go):
-- the purchase token the app sent and Google's order number, each given
-- once (unique); the product bought on Play; and whether it was consumed or
-- acknowledged at Google once given (else Google refunds it after 3 days).
ALTER TABLE purchases ADD COLUMN IF NOT EXISTS play_token TEXT UNIQUE;
ALTER TABLE purchases ADD COLUMN IF NOT EXISTS play_order TEXT UNIQUE;
ALTER TABLE purchases ADD COLUMN IF NOT EXISTS play_product TEXT;
ALTER TABLE purchases ADD COLUMN IF NOT EXISTS play_finished BOOLEAN NOT NULL DEFAULT false;
-- The ones Google hasn't said its last word on, or not yet consumed (asked again now and then: WatchPlay).
CREATE INDEX IF NOT EXISTS purchases_play_open ON purchases (created_at) WHERE play_token IS NOT NULL AND (credited_at IS NULL OR NOT play_finished);
