-- La santé (the update « cycle-vie », sims/sante.go, game/sante.go): a Sim's illness, one at a time.
-- kind: '' when well; stage 1 léger, 2 sérieux, 3 grave; since: when it was caught; net: a mosquito net
-- bought; checked: when the risk and the illness were last brought up to date.
CREATE TABLE IF NOT EXISTS sante (
    sim_id  UUID PRIMARY KEY REFERENCES sims(id) ON DELETE CASCADE,
    kind    TEXT NOT NULL DEFAULT '',
    stage   INT NOT NULL DEFAULT 0,
    since   TIMESTAMPTZ,
    net     BOOLEAN NOT NULL DEFAULT false,
    checked TIMESTAMPTZ NOT NULL DEFAULT now()
);
