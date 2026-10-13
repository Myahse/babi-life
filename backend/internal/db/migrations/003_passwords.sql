-- Email + password accounts, next to Google sign-in. NULL = Google-only.
ALTER TABLE users ADD COLUMN password_hash TEXT;
