-- A baby's « premières fois » (update « premieres-fois »): each one once.
CREATE TABLE sim_firsts (
  sim_id UUID NOT NULL REFERENCES sims(id) ON DELETE CASCADE,
  id TEXT NOT NULL,
  at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (sim_id, id)
);
-- The baby's choices that count (update « choix-bebe »): the toy it went for, its first word.
ALTER TABLE sims ADD COLUMN talent TEXT NOT NULL DEFAULT '';
ALTER TABLE sims ADD COLUMN first_word TEXT NOT NULL DEFAULT '';
