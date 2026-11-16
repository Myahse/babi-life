-- Born, then played grown up (update « naitre-adulte », sims/naitre.go).
-- souvenirs: '' (a Sim from before), 'due' (born with the update open, its « Souvenirs d'enfance » to answer
-- before it starts at 18), 'done'. grown_notice: '' or, for a Sim that was a baby, a child or a teenager
-- when the update opened and was made an adult on its next load, 'due' until the message is seen, then 'seen'.
ALTER TABLE sims ADD COLUMN IF NOT EXISTS souvenirs TEXT NOT NULL DEFAULT '';
ALTER TABLE sims ADD COLUMN IF NOT EXISTS grown_notice TEXT NOT NULL DEFAULT '';

-- The players who had paid « grandir vite » (shop purchases of kind 'grandir', credited, not test, not
-- refunded): not refunded, they're thanked once as « Pionnier » (the badge by the name, the pin, Djai), and
-- their quartier will start at level 2 when that update comes (pionnier_quartier_niveau2, kept for it).
CREATE TABLE IF NOT EXISTS pionniers (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  sim_id UUID REFERENCES sims(id) ON DELETE SET NULL,
  paid INT NOT NULL,
  djai INT NOT NULL,
  pionnier_quartier_niveau2 BOOLEAN NOT NULL DEFAULT true,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  seen_at TIMESTAMPTZ
);

-- The same flag on every Sim of a Pionnier's account (sims/naitre.go sets it with the grant): the quartier
-- (update « mon-quartier ») reads sims.pionnier to start at level 2.
ALTER TABLE sims ADD COLUMN IF NOT EXISTS pionnier BOOLEAN NOT NULL DEFAULT false;
