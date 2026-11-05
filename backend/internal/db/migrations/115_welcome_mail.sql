-- The welcome e-mail (auth/welcome.go): when it went to the account, once. Accounts made before it
-- are marked as done, so only the new ones get it.
ALTER TABLE users ADD COLUMN IF NOT EXISTS welcomed_at TIMESTAMPTZ;
UPDATE users SET welcomed_at = created_at WHERE welcomed_at IS NULL;
