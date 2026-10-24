-- Les idées des joueurs (ideas/ideas.go): what each player suggests from the
-- phone's Idées app (an activity, a place, a bug, anything), the team's
-- answer from /admin, and where it stands (status: new, read, kept, done,
-- no). A Sim's idea stays if the Sim goes.
CREATE TABLE IF NOT EXISTS ideas (
    id          BIGSERIAL PRIMARY KEY,
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    sim_id      UUID REFERENCES sims(id) ON DELETE SET NULL,
    sim_name    TEXT NOT NULL DEFAULT '',
    topic       TEXT NOT NULL DEFAULT 'autre',
    text        TEXT NOT NULL,
    status      TEXT NOT NULL DEFAULT 'new',
    reply       TEXT NOT NULL DEFAULT '',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    answered_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS ideas_user ON ideas (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS ideas_status ON ideas (status, created_at DESC);
