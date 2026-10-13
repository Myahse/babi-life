-- First and last name kept apart (the creator pre-fills the Sim with them),
-- and a public username, unique whatever the case. NULL = not chosen yet
-- (Google sign-ups pick one in the creator).
ALTER TABLE users
    ADD COLUMN first_name TEXT NOT NULL DEFAULT '',
    ADD COLUMN last_name  TEXT NOT NULL DEFAULT '',
    ADD COLUMN username   TEXT;
CREATE UNIQUE INDEX users_username_key ON users (lower(username));

-- Existing accounts: split the display name once.
UPDATE users SET first_name = split_part(name, ' ', 1),
                 last_name  = trim(substr(name, length(split_part(name, ' ', 1)) + 1));
