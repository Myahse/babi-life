-- A house built from a plan goes up over time on its lot (sims/plot.go): the
-- building site, from when to when. The Sim isn't held there meanwhile.
ALTER TABLE plots ADD COLUMN build_from TIMESTAMPTZ, ADD COLUMN build_until TIMESTAMPTZ;
