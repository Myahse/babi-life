-- The players named with « @pseudo » in a message of the grin (update « mentions-grin », sims/mentions.go):
-- their usernames in lower case, resolved when it was written (real players only, at most five), so the app
-- lights them up without asking again. NULL for a message that names nobody (nearly all of them).
ALTER TABLE grin ADD COLUMN IF NOT EXISTS mentions TEXT[];
