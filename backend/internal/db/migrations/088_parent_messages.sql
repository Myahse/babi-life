-- Writing to papa and maman in Gbairai (update « gbairai-parents »): a child's
-- messages to its parents, and their answers (game characters, not players:
-- kept apart from the players' messages). mine: the child wrote it; the
-- parent's answer is written a few seconds later (« en train d'écrire… »).
CREATE TABLE parent_messages (
    id         BIGSERIAL PRIMARY KEY,
    sim_id     UUID NOT NULL REFERENCES sims(id) ON DELETE CASCADE,
    parent     TEXT NOT NULL CHECK (parent IN ('papa', 'maman')),
    mine       BOOLEAN NOT NULL,
    body       TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    read_at    TIMESTAMPTZ
);
CREATE INDEX parent_messages_thread ON parent_messages (sim_id, parent, id);
