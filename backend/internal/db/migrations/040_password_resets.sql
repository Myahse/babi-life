-- « Mot de passe oublié » (auth/reset.go): a link sent by e-mail, good for 30
-- minutes and once. Only the token's hash is kept: the database alone can't
-- reset anyone's password.
CREATE TABLE password_resets (
    token_hash TEXT PRIMARY KEY,
    user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at TIMESTAMPTZ NOT NULL,
    used_at    TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX password_resets_user_idx ON password_resets (user_id, created_at DESC);
