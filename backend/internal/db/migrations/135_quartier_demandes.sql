-- Mon quartier's requests to come in (sims/monquartier.go quartierAsk, quartierAnswer): a player who isn't a
-- friend of a quartier open to friends only asks; pending till the owner answers, ok once let in (it may then
-- visit like a friend, till the owner sends it away: the row goes).
CREATE TABLE IF NOT EXISTS quartier_requests (
    owner      UUID NOT NULL REFERENCES sims(id) ON DELETE CASCADE,
    from_sim   UUID NOT NULL REFERENCES sims(id) ON DELETE CASCADE,
    status     TEXT NOT NULL DEFAULT 'pending',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (owner, from_sim)
);
CREATE INDEX IF NOT EXISTS quartier_requests_from_idx ON quartier_requests (from_sim);
